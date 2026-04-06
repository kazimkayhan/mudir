import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { createSaleAtomic, createSaleSchema } from "@/domain/sales/create-sale";
import { returnSaleAtomic, returnSaleSchema } from "@/domain/sales/return-sale";
import type {
  MutableSaleStore,
  ProductState,
  SaleLineRecord,
  SaleRecord,
} from "@/domain/types";
import { loadAppDatabase } from "@/lib/app-db";
import { appendAuditLog } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";

const productStockRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  on_hand_qty: z.coerce.number().int(),
});

const saleRowSchema = z.object({
  id: z.string(),
  cashier_id: z.string(),
  customer_id: z.string().nullable(),
  subtotal: z.coerce.number(),
  discount_amount: z.coerce.number(),
  tax_amount: z.coerce.number(),
  total_amount: z.coerce.number(),
  paid_amount: z.coerce.number(),
  change_amount: z.coerce.number(),
  created_at: z.string(),
  returned_at: z.string().nullable().optional(),
});

function saleRowToRecord(row: z.infer<typeof saleRowSchema>): SaleRecord {
  return {
    id: row.id,
    cashierId: row.cashier_id,
    customerId: row.customer_id ?? undefined,
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    paidAmount: row.paid_amount,
    changeAmount: row.change_amount,
    createdAt: row.created_at,
    returnedAt: row.returned_at ?? undefined,
  };
}

/**
 * ثبت فروش POS در SQLite: اعتبارسنجی و منطق با `createSaleAtomic`، سپس INSERT فروش،
 * اقلام، حرکت موجودی، پرداخت و به‌روزرسانی `products` در یک تراکنش.
 */
export async function completePosSale(
  raw: unknown,
): Promise<{ saleId: string }> {
  if (!isTauri()) {
    throw new Error("Database is only available inside the Tauri app.");
  }
  const input = createSaleSchema.parse(raw);
  const productIds = [...new Set(input.items.map((i) => i.productId))];

  let saleId = "";

  await runInTransaction(async (db) => {
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await db.select<unknown>(
      `SELECT id, name, on_hand_qty FROM products WHERE id IN (${placeholders})`,
      productIds,
    );
    const parsed = z.array(productStockRowSchema).parse(rows);
    if (parsed.length !== productIds.length) {
      throw new Error("One or more products were not found.");
    }

    const products = new Map<string, ProductState>();
    for (const r of parsed) {
      products.set(r.id, {
        id: r.id,
        name: r.name,
        onHandQty: r.on_hand_qty,
      });
    }

    const store: MutableSaleStore = {
      products,
      sales: [],
      saleItems: new Map(),
      stockMovements: [],
      payments: [],
      auditLogs: [],
    };

    const result = createSaleAtomic(store, input);
    if (!result.ok) {
      throw new Error(result.error);
    }
    const sale = result.sale;
    saleId = sale.id;
    const lines = store.saleItems.get(sale.id);
    if (!lines) {
      throw new Error("Internal error: sale lines missing.");
    }

    await db.execute(
      `INSERT INTO sales (id, cashier_id, customer_id, subtotal, discount_amount, tax_amount, total_amount, paid_amount, change_amount, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        sale.id,
        sale.cashierId,
        sale.customerId ?? null,
        sale.subtotal,
        sale.discountAmount,
        sale.taxAmount,
        sale.totalAmount,
        sale.paidAmount,
        sale.changeAmount,
        sale.createdAt,
      ],
    );

    for (const line of lines) {
      const lineId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)`,
        [lineId, line.saleId, line.productId, line.quantity, line.unitPrice],
      );
    }

    for (const m of store.stockMovements) {
      if (m.refId !== sale.id) {
        continue;
      }
      await db.execute(
        `INSERT INTO stock_movements (id, product_id, type, quantity_delta, ref_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [m.id, m.productId, m.type, m.quantityDelta, m.refId, m.createdAt],
      );
    }

    const payment = store.payments.find((p) => p.saleId === sale.id);
    if (payment) {
      await db.execute(
        `INSERT INTO payments (id, sale_id, amount, created_at) VALUES ($1, $2, $3, $4)`,
        [payment.id, payment.saleId, payment.amount, payment.createdAt],
      );
    }

    for (const [pid, p] of store.products) {
      await db.execute("UPDATE products SET on_hand_qty = $1 WHERE id = $2", [
        p.onHandQty,
        pid,
      ]);
    }

    await appendAuditLog(db, {
      actorUserId: sale.cashierId,
      action: "sale.created",
      entity: "sale",
      entityId: sale.id,
      payload: JSON.stringify({
        total: sale.totalAmount,
        lines: lines.length,
      }),
    });
  });

  return { saleId };
}

export type RecentSaleRow = {
  id: string;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  returned_at: string | null;
};

/** آخرین فروش‌ها برای تاریخچهٔ سبک POS (اختیاری). */
export async function listRecentSales(limit = 50): Promise<RecentSaleRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `SELECT id, total_amount, paid_amount, created_at, returned_at FROM sales ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return z
    .array(
      z.object({
        id: z.string(),
        total_amount: z.coerce.number(),
        paid_amount: z.coerce.number(),
        created_at: z.string(),
        returned_at: z.string().nullable(),
      }),
    )
    .parse(raw);
}

/**
 * برگشت کامل فروش: `returnSaleAtomic` + INSERT حرکت‌های `return` + `returned_at` + موجودی.
 */
export async function returnPosSale(raw: unknown): Promise<void> {
  if (!isTauri()) {
    throw new Error("Database is only available inside the Tauri app.");
  }
  const input = returnSaleSchema.parse(raw);

  await runInTransaction(async (db) => {
    const saleRows = await db.select<unknown>(
      `SELECT id, cashier_id, customer_id, subtotal, discount_amount, tax_amount, total_amount, paid_amount, change_amount, created_at, returned_at FROM sales WHERE id = $1`,
      [input.originalSaleId],
    );
    const saleParsed = z.array(saleRowSchema).parse(saleRows);
    const row = saleParsed[0];
    if (!row) {
      throw new Error("Sale not found");
    }
    if (row.returned_at) {
      throw new Error("Sale already returned");
    }

    const itemRows = await db.select<unknown>(
      `SELECT sale_id, product_id, quantity, unit_price FROM sale_items WHERE sale_id = $1`,
      [input.originalSaleId],
    );
    const itemsParsed = z
      .array(
        z.object({
          sale_id: z.string(),
          product_id: z.string(),
          quantity: z.coerce.number().int(),
          unit_price: z.coerce.number(),
        }),
      )
      .parse(itemRows);

    if (itemsParsed.length === 0) {
      throw new Error("Sale has no lines");
    }

    const productIds = [...new Set(itemsParsed.map((i) => i.product_id))];
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");
    const prodRows = await db.select<unknown>(
      `SELECT id, name, on_hand_qty FROM products WHERE id IN (${placeholders})`,
      productIds,
    );
    const prods = z.array(productStockRowSchema).parse(prodRows);
    if (prods.length !== productIds.length) {
      throw new Error("One or more products were not found.");
    }

    const products = new Map<string, ProductState>();
    for (const r of prods) {
      products.set(r.id, {
        id: r.id,
        name: r.name,
        onHandQty: r.on_hand_qty,
      });
    }

    const lines: SaleLineRecord[] = itemsParsed.map((i) => ({
      saleId: i.sale_id,
      productId: i.product_id,
      quantity: i.quantity,
      unitPrice: i.unit_price,
    }));

    const saleRecord = saleRowToRecord(row);
    const store: MutableSaleStore = {
      products,
      sales: [saleRecord],
      saleItems: new Map([[saleRecord.id, lines]]),
      stockMovements: [],
      payments: [],
      auditLogs: [],
    };

    const result = returnSaleAtomic(store, input);
    if (!result.ok) {
      throw new Error(result.error);
    }

    const returnedAt = store.sales[0]?.returnedAt;
    if (!returnedAt) {
      throw new Error("Internal error: return timestamp missing");
    }

    for (const m of store.stockMovements) {
      await db.execute(
        `INSERT INTO stock_movements (id, product_id, type, quantity_delta, ref_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [m.id, m.productId, m.type, m.quantityDelta, m.refId, m.createdAt],
      );
    }

    await db.execute(`UPDATE sales SET returned_at = $1 WHERE id = $2`, [
      returnedAt,
      saleRecord.id,
    ]);

    for (const [pid, p] of store.products) {
      await db.execute("UPDATE products SET on_hand_qty = $1 WHERE id = $2", [
        p.onHandQty,
        pid,
      ]);
    }

    await appendAuditLog(db, {
      actorUserId: input.cashierId,
      action: "sale.returned",
      entity: "sale",
      entityId: saleRecord.id,
      payload: JSON.stringify({ lines: lines.length }),
    });
  });
}
