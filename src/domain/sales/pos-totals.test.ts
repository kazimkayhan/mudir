import { describe, expect, test } from "vitest";
import { createSaleAtomic } from "@/domain/sales/create-sale";
import { computePosTotals } from "@/domain/sales/pos-totals";
import type { MutableSaleStore } from "@/domain/types";

describe("computePosTotals", () => {
  test("matches createSaleAtomic total for same lines and discount/tax", () => {
    const items = [
      { productId: "a", quantity: 2, unitPrice: 15.5 },
      { productId: "b", quantity: 1, unitPrice: 10 },
    ];
    const discount = 5;
    const tax = 2;
    const { subtotal, total } = computePosTotals(items, discount, tax);

    const store: MutableSaleStore = {
      auditLogs: [],
      payments: [],
      products: new Map([
        ["a", { id: "a", name: "A", onHandQty: 99 }],
        ["b", { id: "b", name: "B", onHandQty: 99 }],
      ]),
      saleItems: new Map(),
      sales: [],
      stockMovements: [],
    };
    const r = createSaleAtomic(store, {
      cashierId: "c",
      discountAmount: discount,
      items,
      paidAmount: total,
      taxAmount: tax,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(subtotal).toBe(r.sale.subtotal);
      expect(total).toBe(r.sale.totalAmount);
    }
  });

  test("total never negative after large discount", () => {
    const { total } = computePosTotals(
      [{ quantity: 1, unitPrice: 10 }],
      100,
      0
    );
    expect(total).toBe(0);
  });
});
