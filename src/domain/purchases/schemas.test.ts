import { describe, expect, test } from "vitest";
import {
  purchaseLinesTotalCost,
  recordPurchaseSchema,
} from "@/domain/purchases/schemas";

describe("recordPurchaseSchema", () => {
  test("accepts minimal valid payload", () => {
    const v = recordPurchaseSchema.parse({
      cashierId: "c1",
      lines: [{ productId: "p1", quantity: 2, unitCost: 5 }],
    });
    expect(v.lines).toHaveLength(1);
  });

  test("rejects empty lines", () => {
    const r = recordPurchaseSchema.safeParse({ cashierId: "c1", lines: [] });
    expect(r.success).toBe(false);
  });
});

describe("purchaseLinesTotalCost", () => {
  test("matches line sum", () => {
    expect(
      purchaseLinesTotalCost([
        { quantity: 2, unitCost: 3 },
        { quantity: 1, unitCost: 10 },
      ]),
    ).toBe(16);
  });
});
