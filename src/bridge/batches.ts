import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import type { BatchStatus } from "@/domain/inventory/batches";
import { loadAppDatabase, selectRows } from "@/lib/app-db";
import { runInTransaction } from "@/lib/run-in-transaction";

const batchRowSchema = z.object({
  expiry_date: z.string().nullable(),
  id: z.string(),
  lot_number: z.string().nullable(),
  notes: z.string().nullable(),
  product_id: z.string(),
  purchase_line_id: z.string().nullable(),
  qty_on_hand: z.coerce.number(),
  received_at: z.string(),
  serial_number: z.string().nullable(),
  status: z.string(),
  unit_cost: z.coerce.number(),
});

export type BatchRow = z.infer<typeof batchRowSchema>;

const BATCH_SELECT =
  "SELECT id, product_id, serial_number, lot_number, expiry_date, qty_on_hand, unit_cost, status, purchase_line_id, received_at, notes FROM inventory_batches";

export async function listBatches(productId?: string): Promise<BatchRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = productId
    ? await db.select<unknown>(
        `${BATCH_SELECT} WHERE product_id = $1 ORDER BY received_at`,
        [productId]
      )
    : await db.select<unknown>(`${BATCH_SELECT} ORDER BY received_at DESC`);
  return z.array(batchRowSchema).parse(raw);
}

export async function listExpiringBatches(
  withinDays: number
): Promise<BatchRow[]> {
  if (!isTauri()) {
    return [];
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `${BATCH_SELECT} WHERE expiry_date IS NOT NULL AND expiry_date <= $1 AND qty_on_hand > 0 AND status = 'available' ORDER BY expiry_date`,
    [cutoff.toISOString().slice(0, 10)]
  );
  return z.array(batchRowSchema).parse(raw);
}

export async function ensureLegacyBatchesBackfill(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  const db = await loadAppDatabase();
  const products = await selectRows<{
    id: string;
    on_hand_qty: number;
    cost_price: number;
  }>(
    db,
    "SELECT id, on_hand_qty, cost_price FROM products WHERE on_hand_qty > 0 AND is_active = 1"
  );
  for (const product of products) {
    const existing = await db.select<unknown>(
      "SELECT id FROM inventory_batches WHERE product_id = $1 LIMIT 1",
      [product.id]
    );
    if (Array.isArray(existing) && existing.length > 0) {
      continue;
    }
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO inventory_batches (id, product_id, lot_number, qty_on_hand, unit_cost, status, received_at)
       VALUES ($1, $2, $3, $4, $5, 'available', $6)`,
      [
        crypto.randomUUID(),
        product.id,
        `LEGACY-${product.id.slice(0, 8)}`,
        product.on_hand_qty,
        product.cost_price ?? 0,
        now,
      ]
    );
  }
}

export async function createBatch(input: {
  expiryDate?: string;
  lotNumber?: string;
  notes?: string;
  productId: string;
  purchaseLineId?: string;
  qtyOnHand: number;
  serialNumber?: string;
  status?: BatchStatus;
  unitCost: number;
}): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await runInTransaction(async (db) => {
    await db.execute(
      `INSERT INTO inventory_batches (id, product_id, serial_number, lot_number, expiry_date, qty_on_hand, unit_cost, status, purchase_line_id, received_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        input.productId,
        input.serialNumber ?? null,
        input.lotNumber ?? null,
        input.expiryDate ?? null,
        input.qtyOnHand,
        input.unitCost,
        input.status ?? "available",
        input.purchaseLineId ?? null,
        now,
        input.notes ?? null,
      ]
    );
  });
  return { id };
}

export async function adjustBatchQty(
  batchId: string,
  delta: number
): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  await runInTransaction(async (db) => {
    await db.execute(
      "UPDATE inventory_batches SET qty_on_hand = qty_on_hand + $1, status = CASE WHEN qty_on_hand + $1 <= 0 THEN 'depleted' ELSE status END WHERE id = $2",
      [delta, batchId]
    );
  });
}
