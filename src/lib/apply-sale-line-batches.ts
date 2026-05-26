import type { InventoryBatch } from "@/domain/inventory/batches";
import type { CreateSaleInput } from "@/domain/types";
import { resolveSaleBatchPicks } from "@/lib/sale-batch-allocation";

interface SaleDb {
  execute: (sql: string, params?: unknown[]) => Promise<unknown>;
}

export async function applySaleLineBatches(
  db: SaleDb,
  inventoryBatches: InventoryBatch[],
  trackingByProduct: Map<string, string>,
  line: { productId: string; quantity: number },
  inputLine: CreateSaleInput["items"][number],
  saleItemId: string
): Promise<void> {
  const trackingMode = trackingByProduct.get(line.productId) ?? "none";
  if (trackingMode === "none") {
    return;
  }

  const picks = resolveSaleBatchPicks(
    inventoryBatches,
    line.productId,
    trackingMode,
    line.quantity,
    inputLine.batchPicks
  );

  for (const pick of picks) {
    await db.execute(
      "INSERT INTO sale_item_batches (id, sale_item_id, batch_id, quantity) VALUES ($1, $2, $3, $4)",
      [crypto.randomUUID(), saleItemId, pick.batchId, pick.quantity]
    );
    await db.execute(
      "UPDATE inventory_batches SET qty_on_hand = qty_on_hand - $1, status = CASE WHEN qty_on_hand - $1 <= 0 THEN 'depleted' ELSE status END WHERE id = $2",
      [pick.quantity, pick.batchId]
    );
    const batch = inventoryBatches.find((entry) => entry.id === pick.batchId);
    if (batch) {
      batch.qtyOnHand -= pick.quantity;
    }
  }
}
