export type BatchStatus = "available" | "quarantine" | "reserved" | "depleted";

export interface InventoryBatch {
  expiryDate?: string;
  id: string;
  lotNumber?: string;
  notes?: string;
  productId: string;
  purchaseLineId?: string;
  qtyOnHand: number;
  receivedAt: string;
  serialNumber?: string;
  status: BatchStatus;
  unitCost: number;
}

export function pickBatchFifo(
  batches: InventoryBatch[],
  quantity: number
): { batchId: string; quantity: number }[] {
  const available = batches
    .filter((b) => b.status === "available" && b.qtyOnHand > 0)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

  const picks: { batchId: string; quantity: number }[] = [];
  let remaining = quantity;

  for (const batch of available) {
    if (remaining <= 0) {
      break;
    }
    const take = Math.min(batch.qtyOnHand, remaining);
    picks.push({ batchId: batch.id, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error("validation.insufficientStock");
  }
  return picks;
}

export function pickBatchFefo(
  batches: InventoryBatch[],
  quantity: number
): { batchId: string; quantity: number }[] {
  const withExpiry = batches.filter(
    (b) => b.status === "available" && b.qtyOnHand > 0 && b.expiryDate
  );
  const withoutExpiry = batches.filter(
    (b) => b.status === "available" && b.qtyOnHand > 0 && !b.expiryDate
  );

  withExpiry.sort((a, b) =>
    (a.expiryDate ?? "").localeCompare(b.expiryDate ?? "")
  );
  withoutExpiry.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

  const picks: { batchId: string; quantity: number }[] = [];
  let remaining = quantity;

  for (const batch of [...withExpiry, ...withoutExpiry]) {
    if (remaining <= 0) {
      break;
    }
    const take = Math.min(batch.qtyOnHand, remaining);
    picks.push({ batchId: batch.id, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error("validation.insufficientStock");
  }
  return picks;
}

export function pickBatchesForProduct(
  batches: InventoryBatch[],
  productId: string,
  quantity: number,
  trackingMode: string
): { batchId: string; quantity: number }[] {
  const productBatches = batches.filter((b) => b.productId === productId);
  if (trackingMode === "lot_expiry") {
    return pickBatchFefo(productBatches, quantity);
  }
  return pickBatchFifo(productBatches, quantity);
}
