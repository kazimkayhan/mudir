import type { InventoryBatch } from "@/domain/inventory/batches";
import { pickBatchesForProduct } from "@/domain/inventory/batches";

export interface SaleBatchPick {
  batchId: string;
  quantity: number;
}

export function resolveSaleBatchPicks(
  batches: InventoryBatch[],
  productId: string,
  trackingMode: string,
  quantity: number,
  explicit?: SaleBatchPick[]
): SaleBatchPick[] {
  if (trackingMode === "none") {
    return [];
  }
  if (explicit && explicit.length > 0) {
    const total = explicit.reduce((sum, pick) => sum + pick.quantity, 0);
    if (total !== quantity) {
      throw new Error("validation.batchQtyMismatch");
    }
    return explicit;
  }
  return pickBatchesForProduct(batches, productId, quantity, trackingMode);
}

export function batchRowToInventoryBatch(row: {
  expiry_date: string | null;
  id: string;
  lot_number: string | null;
  product_id: string;
  purchase_line_id: string | null;
  qty_on_hand: number;
  received_at: string;
  serial_number: string | null;
  status: string;
  unit_cost: number;
}): InventoryBatch {
  return {
    expiryDate: row.expiry_date ?? undefined,
    id: row.id,
    lotNumber: row.lot_number ?? undefined,
    productId: row.product_id,
    purchaseLineId: row.purchase_line_id ?? undefined,
    qtyOnHand: row.qty_on_hand,
    receivedAt: row.received_at,
    serialNumber: row.serial_number ?? undefined,
    status: row.status as InventoryBatch["status"],
    unitCost: row.unit_cost,
  };
}
