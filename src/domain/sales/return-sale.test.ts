import { describe, expect, test } from "vitest";
import { createSaleAtomic } from "@/domain/sales/create-sale";
import { returnSaleAtomic } from "@/domain/sales/return-sale";
import type { MutableSaleStore, SaleRecord } from "@/domain/types";

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

function storeAfterSale(): { store: MutableSaleStore; sale: SaleRecord } {
  const store = emptyStore();
  store.products.set("p1", { id: "p1", name: "Item", onHandQty: 10 });
  const r = createSaleAtomic(store, {
    cashierId: "u1",
    discountAmount: 0,
    items: [{ productId: "p1", quantity: 2, unitPrice: 50 }],
    paidAmount: 100,
    taxAmount: 0,
  });
  if (!r.ok) {
    throw new Error("setup sale failed");
  }
  return { sale: r.sale, store };
}

describe("returnSaleAtomic", () => {
  test("restores stock and marks sale returned", () => {
    const { store, sale } = storeAfterSale();
    expect(store.products.get("p1")?.onHandQty).toBe(8);

    const ret = returnSaleAtomic(store, {
      cashierId: "u1",
      originalSaleId: sale.id,
    });
    expect(ret.ok).toBe(true);
    expect(store.products.get("p1")?.onHandQty).toBe(10);
    expect(store.sales.find((s) => s.id === sale.id)?.returnedAt).toBeDefined();
    const returns = store.stockMovements.filter((m) => m.type === "return");
    expect(returns).toHaveLength(1);
    expect(returns[0]?.quantityDelta).toBe(2);
    expect(returns[0]?.refId).toBe(`return:${sale.id}`);
  });

  test("rejects when sale already returned", () => {
    const { store, sale } = storeAfterSale();
    expect(
      returnSaleAtomic(store, { cashierId: "u1", originalSaleId: sale.id }).ok
    ).toBe(true);
    const beforeQty = store.products.get("p1")?.onHandQty;
    const beforeReturnCount = store.stockMovements.filter(
      (m) => m.type === "return"
    ).length;

    const ret = returnSaleAtomic(store, {
      cashierId: "u1",
      originalSaleId: sale.id,
    });
    expect(ret.ok).toBe(false);
    expect(store.products.get("p1")?.onHandQty).toBe(beforeQty);
    expect(store.stockMovements.filter((m) => m.type === "return").length).toBe(
      beforeReturnCount
    );
  });

  test("rejects unknown sale id", () => {
    const { store } = storeAfterSale();
    const ret = returnSaleAtomic(store, {
      cashierId: "u1",
      originalSaleId: "missing",
    });
    expect(ret.ok).toBe(false);
  });
});
