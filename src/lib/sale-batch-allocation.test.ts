import { describe, expect, test } from "vitest";
import { resolveSaleBatchPicks } from "@/lib/sale-batch-allocation";

describe("sale batch allocation", () => {
  test("auto-picks fifo batches for lot tracking", () => {
    const picks = resolveSaleBatchPicks(
      [
        {
          id: "b1",
          productId: "p1",
          qtyOnHand: 2,
          receivedAt: "2026-01-01",
          status: "available",
          unitCost: 10,
        },
        {
          id: "b2",
          productId: "p1",
          qtyOnHand: 5,
          receivedAt: "2026-02-01",
          status: "available",
          unitCost: 10,
        },
      ],
      "p1",
      "lot",
      3
    );
    expect(picks).toEqual([
      { batchId: "b1", quantity: 2 },
      { batchId: "b2", quantity: 1 },
    ]);
  });
});
