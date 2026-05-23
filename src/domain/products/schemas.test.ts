import { describe, expect, test } from "vitest";
import {
  normalizeSku,
  productUpdateSchema,
  productWriteSchema,
} from "@/domain/products/schemas";

describe("productWriteSchema", () => {
  test("accepts valid draft", () => {
    const r = productWriteSchema.parse({
      condition: "used",
      cost_price: 5,
      currency: "AFN",
      low_stock_threshold: 2,
      name: "  Item  ",
      opening_qty: 5,
      sale_price: 10,
      sku: "",
    });
    expect(r.name).toBe("Item");
    expect(r.condition).toBe("used");
    expect(r.opening_qty).toBe(5);
  });

  test("rejects empty name", () => {
    expect(() =>
      productWriteSchema.parse({
        condition: "new",
        cost_price: 0,
        currency: "AFN",
        low_stock_threshold: 0,
        name: "   ",
        sale_price: 0,
        sku: "",
      })
    ).toThrow();
  });
});

describe("productUpdateSchema", () => {
  test("requires id", () => {
    const r = productUpdateSchema.parse({
      condition: "new",
      cost_price: 1,
      currency: "AFN",
      id: "p1",
      low_stock_threshold: 0,
      name: "A",
      sale_price: 1,
      sku: "x",
    });
    expect(r.id).toBe("p1");
  });
});

describe("normalizeSku", () => {
  test("returns null for blank", () => {
    expect(normalizeSku("  ")).toBeNull();
  });
});
