export type Role = "owner" | "admin" | "manager" | "cashier";

export type SaleItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type CreateSaleInput = {
  cashierId: string;
  customerId?: string;
  discountAmount: number;
  taxAmount: number;
  paidAmount: number;
  items: SaleItemInput[];
};

export type SaleRecord = {
  id: string;
  cashierId: string;
  customerId?: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  createdAt: string;
  /** اگر ست شده باشد، فروش به‌طور کامل برگشت خورده است. */
  returnedAt?: string;
};

export type StockMovementType = "sale" | "return" | "adjustment" | "purchase";

export type StockMovementRecord = {
  id: string;
  productId: string;
  type: StockMovementType;
  quantityDelta: number;
  refId: string;
  createdAt: string;
};

export type SaleLineRecord = {
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type PaymentRecord = {
  id: string;
  saleId: string;
  amount: number;
  createdAt: string;
};

export type AuditLogRecord = {
  id: string;
  actorUserId: string;
  action: string;
  entity: string;
  entityId: string;
  payload: string;
  createdAt: string;
};

export type ProductState = {
  id: string;
  name: string;
  onHandQty: number;
};

export type MutableSaleStore = {
  products: Map<string, ProductState>;
  sales: SaleRecord[];
  saleItems: Map<string, SaleLineRecord[]>;
  stockMovements: StockMovementRecord[];
  payments: PaymentRecord[];
  auditLogs: AuditLogRecord[];
};
