import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { getBusinessSettings } from "@/bridge/settings";
import { requireOperatorId } from "@/bridge/users";
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
import { adjustProductStock } from "@/lib/stock";

const productStockRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  on_hand_qty: z.coerce.number().int(),
});

const saleRowSchema = z.object({
  cashier_id: z.string(),
  change_amount: z.coerce.number(),
  channel: z.string(),
  created_at: z.string(),
  currency_code: z.string(),
  customer_id: z.string().nullable(),
  discount_amount: z.coerce.number(),
  exchange_rate: z.coerce.number(),
  id: z.string(),
  operator_id: z.string().nullable(),
  order_id: z.string().nullable(),
  paid_amount: z.coerce.number(),
  returned_at: z.string().nullable().optional(),
  subtotal: z.coerce.number(),
  tax_amount: z.coerce.number(),
  total_amount: z.coerce.number(),
});

export interface SaleDetail {
  items: {
    id: string;
    product_id: string;
    product_name: string | null;
    quantity: number;
    unit_price: number;
  }[];
  payments: {
    id: string;
    amount: number;
    method: string;
    currency_code: string;
  }[];
  sale: z.infer<typeof saleRowSchema>;
}

function saleRowToRecord(row: z.infer<typeof saleRowSchema>): SaleRecord {
  return {
    cashierId: row.operator_id ?? row.cashier_id,
    changeAmount: row.change_amount,
    createdAt: row.created_at,
    customerId: row.customer_id ?? undefined,
    discountAmount: row.discount_amount,
    id: row.id,
    paidAmount: row.paid_amount,
    returnedAt: row.returned_at ?? undefined,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
  };
}

interface CompleteSaleOptions {
  channel?: "in_store" | "online";
  currencyCode?: "AFN" | "USD";
  exchangeRate?: number;
  orderId?: string;
  payments?: { amount: number; method: string; currencyCode: string }[];
}

export async function completePosSale(
  raw: unknown,
  options: CompleteSaleOptions = {}
): Promise<{ saleId: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = createSaleSchema.parse(raw);
  const operatorId = await requireOperatorId();
  const settings = await getBusinessSettings();
  const channel = options.channel ?? "in_store";
  const currencyCode = options.currencyCode ?? settings.baseCurrency;
  const exchangeRate =
    options.exchangeRate ??
    (currencyCode === "USD" ? settings.usdToAfnRate : 1);
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  let saleId = "";

  await runInTransaction(async (db) => {
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await db.select<unknown>(
      `SELECT id, name, on_hand_qty FROM products WHERE id IN (${placeholders}) AND is_active = 1`,
      productIds
    );
    const parsed = z.array(productStockRowSchema).parse(rows);
    if (parsed.length !== productIds.length) {
      throw new Error("validation.insufficientStock");
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
      auditLogs: [],
      payments: [],
      products,
      saleItems: new Map(),
      sales: [],
      stockMovements: [],
    };

    const result = createSaleAtomic(store, {
      ...input,
      cashierId: operatorId,
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    const sale = result.sale;
    saleId = sale.id;
    const lines = store.saleItems.get(sale.id);
    if (!lines) {
      throw new Error("validation.internalError");
    }

    await db.execute(
      `INSERT INTO sales (id, cashier_id, operator_id, customer_id, channel, order_id, currency_code, exchange_rate, subtotal, discount_amount, tax_amount, total_amount, paid_amount, change_amount, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        sale.id,
        operatorId,
        operatorId,
        sale.customerId ?? null,
        channel,
        options.orderId ?? null,
        currencyCode,
        exchangeRate,
        sale.subtotal,
        sale.discountAmount,
        sale.taxAmount,
        sale.totalAmount,
        sale.paidAmount,
        sale.changeAmount,
        sale.createdAt,
      ]
    );

    for (const line of lines) {
      const lineId = crypto.randomUUID();
      await db.execute(
        "INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)",
        [lineId, line.saleId, line.productId, line.quantity, line.unitPrice]
      );
    }

    for (const m of store.stockMovements) {
      if (m.refId !== sale.id) {
        continue;
      }
      await db.execute(
        "INSERT INTO stock_movements (id, product_id, type, quantity_delta, ref_id, operator_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          m.id,
          m.productId,
          m.type,
          m.quantityDelta,
          m.refId,
          operatorId,
          m.createdAt,
        ]
      );
      await adjustProductStock(db, m.productId, m.quantityDelta);
    }

    const paymentRows = options.payments ?? [
      {
        amount: sale.paidAmount,
        currencyCode,
        method: "cash",
      },
    ];

    for (const p of paymentRows) {
      await db.execute(
        "INSERT INTO payments (id, sale_id, amount, method, currency_code, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          crypto.randomUUID(),
          sale.id,
          p.amount,
          p.method,
          p.currencyCode,
          sale.createdAt,
        ]
      );
    }

    await appendAuditLog(db, {
      action: "sale.created",
      actorUserId: operatorId,
      entity: "sale",
      entityId: sale.id,
      payload: JSON.stringify({
        channel,
        lines: lines.length,
        total: sale.totalAmount,
      }),
    });
  });

  return { saleId };
}

export interface RecentSaleRow {
  channel: string;
  created_at: string;
  currency_code: string;
  id: string;
  paid_amount: number;
  returned_at: string | null;
  total_amount: number;
}

export async function listRecentSales(limit = 50): Promise<RecentSaleRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, total_amount, paid_amount, channel, currency_code, created_at, returned_at FROM sales ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return z
    .array(
      z.object({
        channel: z.string(),
        created_at: z.string(),
        currency_code: z.string(),
        id: z.string(),
        paid_amount: z.coerce.number(),
        returned_at: z.string().nullable(),
        total_amount: z.coerce.number(),
      })
    )
    .parse(raw);
}

export async function getSaleDetail(
  saleId: string
): Promise<SaleDetail | null> {
  if (!isTauri()) {
    return null;
  }
  const db = await loadAppDatabase();
  const saleRaw = await db.select<unknown>(
    "SELECT id, cashier_id, operator_id, customer_id, channel, order_id, currency_code, exchange_rate, subtotal, discount_amount, tax_amount, total_amount, paid_amount, change_amount, created_at, returned_at FROM sales WHERE id = $1",
    [saleId]
  );
  const sales = z.array(saleRowSchema).parse(saleRaw);
  const sale = sales[0];
  if (!sale) {
    return null;
  }
  const itemsRaw = await db.select<unknown>(
    `SELECT si.id, si.product_id, p.name AS product_name, si.quantity, si.unit_price
     FROM sale_items si LEFT JOIN products p ON p.id = si.product_id WHERE si.sale_id = $1`,
    [saleId]
  );
  const items = z
    .array(
      z.object({
        id: z.string(),
        product_id: z.string(),
        product_name: z.string().nullable(),
        quantity: z.coerce.number(),
        unit_price: z.coerce.number(),
      })
    )
    .parse(itemsRaw);
  const payRaw = await db.select<unknown>(
    "SELECT id, amount, method, currency_code FROM payments WHERE sale_id = $1",
    [saleId]
  );
  const payments = z
    .array(
      z.object({
        amount: z.coerce.number(),
        currency_code: z.string(),
        id: z.string(),
        method: z.string(),
      })
    )
    .parse(payRaw);
  return { items, payments, sale };
}

export async function returnPosSale(raw: unknown): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = returnSaleSchema.parse(raw);
  const operatorId = await requireOperatorId();

  await runInTransaction(async (db) => {
    const saleRows = await db.select<unknown>(
      "SELECT id, cashier_id, operator_id, customer_id, channel, order_id, currency_code, exchange_rate, subtotal, discount_amount, tax_amount, total_amount, paid_amount, change_amount, created_at, returned_at FROM sales WHERE id = $1",
      [input.originalSaleId]
    );
    const saleParsed = z.array(saleRowSchema).parse(saleRows);
    const row = saleParsed[0];
    if (!row) {
      throw new Error("validation.saleNotFound");
    }
    if (row.returned_at) {
      throw new Error("validation.saleAlreadyReturned");
    }

    const itemRows = await db.select<unknown>(
      "SELECT sale_id, product_id, quantity, unit_price FROM sale_items WHERE sale_id = $1",
      [input.originalSaleId]
    );
    const itemsParsed = z
      .array(
        z.object({
          product_id: z.string(),
          quantity: z.coerce.number().int(),
          sale_id: z.string(),
          unit_price: z.coerce.number(),
        })
      )
      .parse(itemRows);

    const productIds = [...new Set(itemsParsed.map((i) => i.product_id))];
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");
    const prodRows = await db.select<unknown>(
      `SELECT id, name, on_hand_qty FROM products WHERE id IN (${placeholders})`,
      productIds
    );
    const prods = z.array(productStockRowSchema).parse(prodRows);

    const products = new Map<string, ProductState>();
    for (const r of prods) {
      products.set(r.id, {
        id: r.id,
        name: r.name,
        onHandQty: r.on_hand_qty,
      });
    }

    const lines: SaleLineRecord[] = itemsParsed.map((i) => ({
      productId: i.product_id,
      quantity: i.quantity,
      saleId: i.sale_id,
      unitPrice: i.unit_price,
    }));

    const saleRecord = saleRowToRecord(row);
    const store: MutableSaleStore = {
      auditLogs: [],
      payments: [],
      products,
      saleItems: new Map([[saleRecord.id, lines]]),
      sales: [saleRecord],
      stockMovements: [],
    };

    const result = returnSaleAtomic(store, {
      ...input,
      cashierId: operatorId,
    });
    if (!result.ok) {
      throw new Error(result.error);
    }

    const returnedAt = store.sales[0]?.returnedAt;
    if (!returnedAt) {
      throw new Error("validation.internalError");
    }

    for (const m of store.stockMovements) {
      await db.execute(
        "INSERT INTO stock_movements (id, product_id, type, quantity_delta, ref_id, operator_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          m.id,
          m.productId,
          m.type,
          m.quantityDelta,
          m.refId,
          operatorId,
          m.createdAt,
        ]
      );
      await adjustProductStock(db, m.productId, m.quantityDelta);
    }

    await db.execute("UPDATE sales SET returned_at = $1 WHERE id = $2", [
      returnedAt,
      saleRecord.id,
    ]);

    await appendAuditLog(db, {
      action: "sale.returned",
      actorUserId: operatorId,
      entity: "sale",
      entityId: saleRecord.id,
      payload: JSON.stringify({ lines: lines.length }),
    });
  });
}

export async function getDashboardSalesTotals(): Promise<{
  inStoreToday: number;
  onlineToday: number;
  pendingOrders: number;
}> {
  if (!isTauri()) {
    return { inStoreToday: 0, onlineToday: 0, pendingOrders: 0 };
  }
  const db = await loadAppDatabase();
  const today = new Date().toISOString().slice(0, 10);
  const inStoreRaw = await db.select<unknown>(
    `SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE channel = 'in_store' AND returned_at IS NULL AND created_at >= $1`,
    [`${today}T00:00:00.000Z`]
  );
  const onlineRaw = await db.select<unknown>(
    `SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE channel = 'online' AND returned_at IS NULL AND created_at >= $1`,
    [`${today}T00:00:00.000Z`]
  );
  const pendingRaw = await db.select<unknown>(
    "SELECT COUNT(*) as n FROM online_orders WHERE status IN ('pending', 'confirmed')"
  );
  const totalRows = z.array(z.object({ total: z.coerce.number() }));
  const countRows = z.array(z.object({ n: z.coerce.number() }));
  return {
    inStoreToday: totalRows.parse(inStoreRaw)[0]?.total ?? 0,
    onlineToday: totalRows.parse(onlineRaw)[0]?.total ?? 0,
    pendingOrders: countRows.parse(pendingRaw)[0]?.n ?? 0,
  };
}
