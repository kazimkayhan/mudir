import { describe, expect, test } from "vitest";
import {
  formValuesToDelta,
  inventoryFormSchema,
} from "@/domain/inventory/schemas";

describe("formValuesToDelta", () => {
  test("purchase positive", () => {
    const v = inventoryFormSchema.parse({
      movementType: "purchase",
      productId: "p1",
      qty: 5,
    });
    expect(formValuesToDelta(v)).toBe(5);
  });

  test("sale negative", () => {
    const v = inventoryFormSchema.parse({
      movementType: "sale",
      productId: "p1",
      qty: 3,
    });
    expect(formValuesToDelta(v)).toBe(-3);
  });

  test("adjustment signed", () => {
    const v = inventoryFormSchema.parse({
      adjustmentDelta: -2,
      movementType: "adjustment",
      productId: "p1",
    });
    expect(formValuesToDelta(v)).toBe(-2);
  });
});
