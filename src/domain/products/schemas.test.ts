import { describe, expect, test } from "vitest";
import {
  normalizeSku,
  productUpdateSchema,
  productWriteSchema,
} from "@/domain/products/schemas";

describe("productWriteSchema", () => {
  test("accepts valid draft", () => {
    const r = productWriteSchema.parse({
      name: "  Item  ",
      sku: "",
      on_hand_qty: 5,
    });
    expect(r.name).toBe("Item");
    expect(r.on_hand_qty).toBe(5);
  });

  test("rejects empty name", () => {
    expect(() =>
      productWriteSchema.parse({ name: "   ", sku: "", on_hand_qty: 0 }),
    ).toThrow();
  });
});

describe("productUpdateSchema", () => {
  test("requires id", () => {
    const r = productUpdateSchema.parse({
      id: "p1",
      name: "A",
      sku: "x",
      on_hand_qty: 1,
    });
    expect(r.id).toBe("p1");
  });
});

describe("normalizeSku", () => {
  test("returns null for blank", () => {
    expect(normalizeSku("  ")).toBeNull();
  });
});
