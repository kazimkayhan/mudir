import { describe, expect, test } from "vitest";
import {
  formValuesToDelta,
  inventoryFormSchema,
} from "@/domain/inventory/schemas";

describe("formValuesToDelta", () => {
  test("purchase positive", () => {
    const v = inventoryFormSchema.parse({
      productId: "p1",
      movementType: "purchase",
      qty: 5,
    });
    expect(formValuesToDelta(v)).toBe(5);
  });

  test("sale negative", () => {
    const v = inventoryFormSchema.parse({
      productId: "p1",
      movementType: "sale",
      qty: 3,
    });
    expect(formValuesToDelta(v)).toBe(-3);
  });

  test("adjustment signed", () => {
    const v = inventoryFormSchema.parse({
      productId: "p1",
      movementType: "adjustment",
      adjustmentDelta: -2,
    });
    expect(formValuesToDelta(v)).toBe(-2);
  });
});
