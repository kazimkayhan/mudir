import { describe, expect, test } from "vitest";
import { createSaleAtomic } from "@/domain/sales/create-sale";
import type { MutableSaleStore } from "@/domain/types";

function emptyStore(): MutableSaleStore {
  return {
    auditLogs: [],
    payments: [],
    products: new Map(),
    saleItems: new Map(),
    sales: [],
    stockMovements: [],
  };
}

describe("createSaleAtomic", () => {
  test("commits sale, stock, payment, audit together", () => {
    const store = emptyStore();
    store.products.set("p1", { id: "p1", name: "Item", onHandQty: 10 });

    const result = createSaleAtomic(store, {
      cashierId: "u1",
      discountAmount: 0,
      items: [{ productId: "p1", quantity: 2, unitPrice: 50 }],
      paidAmount: 100,
      taxAmount: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(store.sales).toHaveLength(1);
    expect(store.products.get("p1")?.onHandQty).toBe(8);
    expect(store.stockMovements).toHaveLength(1);
    expect(store.payments).toHaveLength(1);
    expect(store.auditLogs).toHaveLength(1);
    expect(store.saleItems.get(result.sale.id)?.length).toBe(1);
  });

  test("rolls back completely on insufficient stock", () => {
    const store = emptyStore();
    store.products.set("p1", { id: "p1", name: "Item", onHandQty: 1 });

    const before = {
      audLen: store.auditLogs.length,
      movLen: store.stockMovements.length,
      payLen: store.payments.length,
      qty: store.products.get("p1")?.onHandQty,
      salesLen: store.sales.length,
    };

    const result = createSaleAtomic(store, {
      cashierId: "u1",
      discountAmount: 0,
      items: [
        { productId: "p1", quantity: 1, unitPrice: 30 },
        { productId: "p1", quantity: 2, unitPrice: 35 },
      ],
      paidAmount: 100,
      taxAmount: 0,
    });

    expect(result.ok).toBe(false);
    expect(store.sales.length).toBe(before.salesLen);
    expect(store.stockMovements.length).toBe(before.movLen);
    expect(store.payments.length).toBe(before.payLen);
    expect(store.auditLogs.length).toBe(before.audLen);
    expect(store.products.get("p1")?.onHandQty).toBe(before.qty);
  });

  test("rejects when paidAmount is less than total", () => {
    const store = emptyStore();
    store.products.set("p1", { id: "p1", name: "Item", onHandQty: 10 });

    const result = createSaleAtomic(store, {
      cashierId: "u1",
      discountAmount: 0,
      items: [{ productId: "p1", quantity: 2, unitPrice: 50 }],
      paidAmount: 99,
      taxAmount: 0,
    });

    expect(result.ok).toBe(false);
    expect(store.sales).toHaveLength(0);
    expect(store.products.get("p1")?.onHandQty).toBe(10);
  });
});
