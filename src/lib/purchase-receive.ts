import type { RecordPurchaseInput } from "@/domain/purchases/schemas";

interface PurchaseDb {
  execute: (sql: string, params?: unknown[]) => Promise<unknown>;
}

export async function createBatchesForPurchaseLine(
  db: PurchaseDb,
  line: RecordPurchaseInput["lines"][number],
  lineId: string,
  now: string,
  trackingMode: string
): Promise<void> {
  if (trackingMode === "serial") {
    const serials = line.serialNumbers ?? [];
    if (serials.length !== line.quantity) {
      throw new Error("validation.serialCountMismatch");
    }
    for (const serialNumber of serials) {
      await db.execute(
        `INSERT INTO inventory_batches (id, product_id, serial_number, qty_on_hand, unit_cost, status, purchase_line_id, received_at)
         VALUES ($1, $2, $3, 1, $4, 'available', $5, $6)`,
        [
          crypto.randomUUID(),
          line.productId,
          serialNumber.trim(),
          line.unitCost,
          lineId,
          now,
        ]
      );
    }
    return;
  }

  if (trackingMode === "lot" || trackingMode === "lot_expiry") {
    await db.execute(
      `INSERT INTO inventory_batches (id, product_id, lot_number, expiry_date, qty_on_hand, unit_cost, status, purchase_line_id, received_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'available', $7, $8)`,
      [
        crypto.randomUUID(),
        line.productId,
        line.lotNumber?.trim() ?? null,
        line.expiryDate ?? null,
        line.quantity,
        line.unitCost,
        lineId,
        now,
      ]
    );
  }
}
