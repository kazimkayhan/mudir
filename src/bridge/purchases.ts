import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import {
  purchaseLinesTotalCost,
  recordPurchaseSchema,
} from "@/domain/purchases/schemas";
import { loadAppDatabase } from "@/lib/app-db";
import { appendAuditLog } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";

const purchaseRowSchema = z.object({
  id: z.string(),
  supplier_id: z.string().nullable(),
  reference: z.string().nullable(),
  total_cost: z.coerce.number(),
  notes: z.string().nullable(),
  cashier_id: z.string(),
  created_at: z.string(),
});

export type PurchaseRow = z.infer<typeof purchaseRowSchema>;

export async function listPurchases(limit = 100): Promise<PurchaseRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `SELECT id, supplier_id, reference, total_cost, notes, cashier_id, created_at
     FROM purchases ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return z.array(purchaseRowSchema).parse(raw);
}

/**
 * ثبت خرید: ردیف خرید + خطوط + حرکت موجودی `purchase` + افزایش `on_hand_qty` در یک تراکنش.
 */
export async function recordPurchase(raw: unknown): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("Database is only available inside the Tauri app.");
  }
  const input = recordPurchaseSchema.parse(raw);
  const totalCost = purchaseLinesTotalCost(input.lines);
  const productIds = [...new Set(input.lines.map((l) => l.productId))];

  let purchaseId = "";

  await runInTransaction(async (db) => {
    if (input.supplierId) {
      const sup = await db.select<unknown>(
        "SELECT id FROM suppliers WHERE id = $1",
        [input.supplierId],
      );
      if (z.array(z.object({ id: z.string() })).parse(sup).length === 0) {
        throw new Error("Supplier not found.");
      }
    }

    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");
    const prodCheck = await db.select<unknown>(
      `SELECT id FROM products WHERE id IN (${placeholders})`,
      productIds,
    );
    if (
      z.array(z.object({ id: z.string() })).parse(prodCheck).length !==
      productIds.length
    ) {
      throw new Error("One or more products were not found.");
    }

    purchaseId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO purchases (id, supplier_id, reference, total_cost, notes, cashier_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        purchaseId,
        input.supplierId ?? null,
        input.reference ?? null,
        totalCost,
        input.notes ?? null,
        input.cashierId,
        now,
      ],
    );

    for (const line of input.lines) {
      const lineId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO purchase_lines (id, purchase_id, product_id, quantity, unit_cost) VALUES ($1, $2, $3, $4, $5)`,
        [lineId, purchaseId, line.productId, line.quantity, line.unitCost],
      );

      const stockRows = await db.select<unknown>(
        "SELECT on_hand_qty FROM products WHERE id = $1",
        [line.productId],
      );
      const parsed = z
        .array(z.object({ on_hand_qty: z.coerce.number().int() }))
        .parse(stockRows);
      const current = parsed[0]?.on_hand_qty;
      if (current === undefined) {
        throw new Error("Product not found");
      }
      const next = current + line.quantity;
      const movId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO stock_movements (id, product_id, type, quantity_delta, ref_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [movId, line.productId, "purchase", line.quantity, purchaseId, now],
      );
      await db.execute("UPDATE products SET on_hand_qty = $1 WHERE id = $2", [
        next,
        line.productId,
      ]);
    }

    await appendAuditLog(db, {
      actorUserId: input.cashierId,
      action: "purchase.recorded",
      entity: "purchase",
      entityId: purchaseId,
      payload: JSON.stringify({
        totalCost,
        lineCount: input.lines.length,
      }),
    });
  });

  return { id: purchaseId };
}
