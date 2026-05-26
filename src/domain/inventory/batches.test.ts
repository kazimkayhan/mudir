import { describe, expect, it } from "vitest";
import { type InventoryBatch, pickBatchFefo } from "@/domain/inventory/batches";

describe("batch picking", () => {
  const batches: InventoryBatch[] = [
    {
      expiryDate: "2026-06-01",
      id: "b1",
      productId: "p1",
      qtyOnHand: 5,
      receivedAt: "2026-01-01",
      status: "available",
      unitCost: 1,
    },
    {
      expiryDate: "2026-03-01",
      id: "b2",
      productId: "p1",
      qtyOnHand: 5,
      receivedAt: "2026-01-02",
      status: "available",
      unitCost: 1,
    },
  ];

  it("picks earliest expiry first", () => {
    const picks = pickBatchFefo(batches, 3);
    expect(picks[0]?.batchId).toBe("b2");
  });
});
