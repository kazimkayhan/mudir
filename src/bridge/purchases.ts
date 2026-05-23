import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { getBusinessSettings } from "@/bridge/settings";
import { requireOperatorId } from "@/bridge/users";
import {
  purchaseLinesTotalCost,
  recordPurchaseSchema,
} from "@/domain/purchases/schemas";
import { loadAppDatabase } from "@/lib/app-db";
import { appendAuditLog } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";
import { adjustProductStock } from "@/lib/stock";

const purchaseRowSchema = z.object({
  cashier_id: z.string(),
  created_at: z.string(),
  currency_code: z.string(),
  exchange_rate: z.coerce.number(),
  id: z.string(),
  notes: z.string().nullable(),
  operator_id: z.string().nullable(),
  reference: z.string().nullable(),
  supplier_id: z.string().nullable(),
  supplier_name: z.string().nullable().optional(),
  total_cost: z.coerce.number(),
});

export type PurchaseRow = z.infer<typeof purchaseRowSchema>;

export async function listPurchases(limit = 100): Promise<PurchaseRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `SELECT p.id, p.supplier_id, s.name AS supplier_name, p.reference, p.total_cost, p.notes, p.cashier_id, p.operator_id, p.currency_code, p.exchange_rate, p.created_at
     FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
     ORDER BY p.created_at DESC LIMIT $1`,
    [limit]
  );
  return z.array(purchaseRowSchema).parse(raw);
}

export async function getPurchaseDetail(purchaseId: string): Promise<{
  purchase: PurchaseRow;
  lines: {
    id: string;
    product_id: string;
    product_name: string | null;
    quantity: number;
    unit_cost: number;
  }[];
} | null> {
  if (!isTauri()) {
    return null;
  }
  const db = await loadAppDatabase();
  const pRaw = await db.select<unknown>(
    `SELECT p.id, p.supplier_id, s.name AS supplier_name, p.reference, p.total_cost, p.notes, p.cashier_id, p.operator_id, p.currency_code, p.exchange_rate, p.created_at
     FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = $1`,
    [purchaseId]
  );
  const purchases = z.array(purchaseRowSchema).parse(pRaw);
  const purchase = purchases[0];
  if (!purchase) {
    return null;
  }
  const linesRaw = await db.select<unknown>(
    `SELECT pl.id, pl.product_id, pr.name AS product_name, pl.quantity, pl.unit_cost
     FROM purchase_lines pl LEFT JOIN products pr ON pr.id = pl.product_id WHERE pl.purchase_id = $1`,
    [purchaseId]
  );
  const lines = z
    .array(
      z.object({
        id: z.string(),
        product_id: z.string(),
        product_name: z.string().nullable(),
        quantity: z.coerce.number(),
        unit_cost: z.coerce.number(),
      })
    )
    .parse(linesRaw);
  return { lines, purchase };
}

export async function recordPurchase(raw: unknown): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = recordPurchaseSchema.parse(raw);
  const operatorId = await requireOperatorId();
  const settings = await getBusinessSettings();
  const currencyCode = input.currency_code ?? settings.baseCurrency;
  const exchangeRate = currencyCode === "USD" ? settings.usdToAfnRate : 1;
  const totalCost = purchaseLinesTotalCost(input.lines);
  const productIds = [...new Set(input.lines.map((l) => l.productId))];
  let purchaseId = "";

  await runInTransaction(async (db) => {
    if (input.supplierId) {
      const sup = await db.select<unknown>(
        "SELECT id FROM suppliers WHERE id = $1",
        [input.supplierId]
      );
      if (z.array(z.object({ id: z.string() })).parse(sup).length === 0) {
        throw new Error("Supplier not found");
      }
    }

    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");
    const prodCheck = await db.select<unknown>(
      `SELECT id FROM products WHERE id IN (${placeholders}) AND is_active = 1`,
      productIds
    );
    if (
      z.array(z.object({ id: z.string() })).parse(prodCheck).length !==
      productIds.length
    ) {
      throw new Error("Product not found");
    }

    purchaseId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO purchases (id, supplier_id, reference, total_cost, notes, cashier_id, operator_id, currency_code, exchange_rate, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        purchaseId,
        input.supplierId ?? null,
        input.reference ?? null,
        totalCost,
        input.notes ?? null,
        operatorId,
        operatorId,
        currencyCode,
        exchangeRate,
        now,
      ]
    );

    for (const line of input.lines) {
      const lineId = crypto.randomUUID();
      await db.execute(
        "INSERT INTO purchase_lines (id, purchase_id, product_id, quantity, unit_cost) VALUES ($1, $2, $3, $4, $5)",
        [lineId, purchaseId, line.productId, line.quantity, line.unitCost]
      );
      const movId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO stock_movements (id, product_id, type, quantity_delta, ref_id, operator_id, created_at) VALUES ($1, $2, 'purchase', $3, $4, $5, $6)`,
        [movId, line.productId, line.quantity, purchaseId, operatorId, now]
      );
      await adjustProductStock(db, line.productId, line.quantity);
      await db.execute("UPDATE products SET cost_price = $1 WHERE id = $2", [
        line.unitCost,
        line.productId,
      ]);
    }

    await appendAuditLog(db, {
      action: "purchase.recorded",
      actorUserId: operatorId,
      entity: "purchase",
      entityId: purchaseId,
      payload: JSON.stringify({ lineCount: input.lines.length, totalCost }),
    });
  });

  return { id: purchaseId };
}

export async function listPurchasesForSupplier(
  supplierId: string,
  limit = 50
): Promise<PurchaseRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `SELECT p.id, p.supplier_id, s.name AS supplier_name, p.reference, p.total_cost, p.notes, p.cashier_id, p.operator_id, p.currency_code, p.exchange_rate, p.created_at
     FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.supplier_id = $1 ORDER BY p.created_at DESC LIMIT $2`,
    [supplierId, limit]
  );
  return z.array(purchaseRowSchema).parse(raw);
}
