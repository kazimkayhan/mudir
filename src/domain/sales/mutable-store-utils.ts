import type {
  MutableSaleStore,
  ProductState,
  SaleLineRecord,
} from "@/domain/types";

export function cloneMutableSaleStore(
  store: MutableSaleStore
): MutableSaleStore {
  const products = new Map<string, ProductState>();
  for (const [id, p] of store.products) {
    products.set(id, { ...p });
  }
  const saleItems = new Map<string, SaleLineRecord[]>();
  for (const [saleId, lines] of store.saleItems) {
    saleItems.set(
      saleId,
      lines.map((line) => ({ ...line }))
    );
  }
  return {
    auditLogs: store.auditLogs.map((a) => ({ ...a })),
    payments: store.payments.map((p) => ({ ...p })),
    products,
    saleItems,
    sales: store.sales.map((s) => ({ ...s })),
    stockMovements: store.stockMovements.map((m) => ({ ...m })),
  };
}

export function restoreMutableSaleStore(
  target: MutableSaleStore,
  snapshot: MutableSaleStore
): void {
  target.products = snapshot.products;
  target.sales = snapshot.sales;
  target.saleItems = snapshot.saleItems;
  target.stockMovements = snapshot.stockMovements;
  target.payments = snapshot.payments;
  target.auditLogs = snapshot.auditLogs;
}
