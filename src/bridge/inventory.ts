import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { requireOperatorId } from "@/bridge/users";
import {
  type ApplyMovementInput,
  applyMovementSchema,
  stockMovementTypeSchema,
} from "@/domain/inventory/schemas";
import { loadAppDatabase } from "@/lib/app-db";
import { appendAuditLog } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";
import { adjustProductStock } from "@/lib/stock";

const movementRowSchema = z.object({
  created_at: z.string(),
  id: z.string(),
  product_id: z.string(),
  product_name: z.string().nullable(),
  quantity_delta: z.coerce.number().int(),
  ref_id: z.string(),
  type: stockMovementTypeSchema,
});

export type StockMovementListRow = z.infer<typeof movementRowSchema>;

export async function applyStockMovement(raw: unknown): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const input: ApplyMovementInput = applyMovementSchema.parse(raw);
  const operatorId = await requireOperatorId();

  await runInTransaction(async (db) => {
    const rows = await db.select<unknown>(
      "SELECT id FROM products WHERE id = $1 AND is_active = 1",
      [input.product_id]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Product not found");
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO stock_movements (id, product_id, type, quantity_delta, ref_id, operator_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        id,
        input.product_id,
        input.type,
        input.quantity_delta,
        input.ref_id,
        operatorId,
        now,
      ]
    );
    await adjustProductStock(db, input.product_id, input.quantity_delta);

    await appendAuditLog(db, {
      action: "stock.movement",
      actorUserId: operatorId,
      entity: "stock_movement",
      entityId: id,
      payload: JSON.stringify({
        delta: input.quantity_delta,
        product_id: input.product_id,
        type: input.type,
      }),
    });
  });
}

export async function listStockMovements(
  limit = 200
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
    [limit]
  );
  return z.array(movementRowSchema).parse(raw);
}

export async function listMovementsForProduct(
  productId: string,
  limit = 50
): Promise<StockMovementListRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `SELECT m.id, m.product_id, p.name AS product_name, m.type, m.quantity_delta, m.ref_id, m.created_at
     FROM stock_movements m
     LEFT JOIN products p ON p.id = m.product_id
     WHERE m.product_id = $1 ORDER BY m.created_at DESC LIMIT $2`,
    [productId, limit]
  );
  return z.array(movementRowSchema).parse(raw);
}
