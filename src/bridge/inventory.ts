import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import {
  type ApplyMovementInput,
  applyMovementSchema,
  stockMovementTypeSchema,
} from "@/domain/inventory/schemas";
import { loadAppDatabase } from "@/lib/app-db";
import { appendAuditLog, DEFAULT_AUDIT_ACTOR_ID } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";

const movementRowSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  product_name: z.string().nullable(),
  type: stockMovementTypeSchema,
  quantity_delta: z.coerce.number().int(),
  ref_id: z.string(),
  created_at: z.string(),
});

export type StockMovementListRow = z.infer<typeof movementRowSchema>;

/** اعمال حرکت + به‌روزرسانی `products.on_hand_qty` در یک تراکنش (SQLite). */
export async function applyStockMovement(raw: unknown): Promise<void> {
  if (!isTauri()) {
    throw new Error("Database is only available inside the Tauri app.");
  }
  const input: ApplyMovementInput = applyMovementSchema.parse(raw);

  await runInTransaction(async (db) => {
    const rows = await db.select<unknown>(
      "SELECT on_hand_qty FROM products WHERE id = $1",
      [input.product_id],
    );
    const parsed = z
      .array(z.object({ on_hand_qty: z.coerce.number().int() }))
      .parse(rows);
    const current = parsed[0]?.on_hand_qty;
    if (current === undefined) {
      throw new Error("Product not found");
    }
    const next = current + input.quantity_delta;
    if (next < 0) {
      throw new Error("Insufficient stock for this movement");
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO stock_movements (id, product_id, type, quantity_delta, ref_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        id,
        input.product_id,
        input.type,
        input.quantity_delta,
        input.ref_id,
        now,
      ],
    );
    await db.execute("UPDATE products SET on_hand_qty = $1 WHERE id = $2", [
      next,
      input.product_id,
    ]);

    await appendAuditLog(db, {
      actorUserId: DEFAULT_AUDIT_ACTOR_ID,
      action: "stock.movement",
      entity: "stock_movement",
      entityId: id,
      payload: JSON.stringify({
        product_id: input.product_id,
        type: input.type,
        delta: input.quantity_delta,
        ref_id: input.ref_id,
      }),
    });
  });
}

export async function listStockMovements(
  limit = 200,
): Promise<StockMovementListRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `SELECT m.id, m.product_id, p.name AS product_name, m.type, m.quantity_delta, m.ref_id, m.created_at
     FROM stock_movements m
     LEFT JOIN products p ON p.id = m.product_id
     ORDER BY m.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return z.array(movementRowSchema).parse(raw);
}
