export type Role = "owner" | "admin" | "manager" | "cashier";

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateSaleInput {
  cashierId: string;
  customerId?: string;
  discountAmount: number;
  items: SaleItemInput[];
  paidAmount: number;
  taxAmount: number;
}

export interface SaleRecord {
  cashierId: string;
  changeAmount: number;
  createdAt: string;
  customerId?: string;
  discountAmount: number;
  id: string;
  paidAmount: number;
  /** اگر ست شده باشد، فروش به‌طور کامل برگشت خورده است. */
  returnedAt?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export type StockMovementType =
  | "sale"
  | "return"
  | "adjustment"
  | "purchase"
  | "opening";

export interface StockMovementRecord {
  createdAt: string;
  id: string;
  productId: string;
  quantityDelta: number;
  refId: string;
  type: StockMovementType;
}

export interface SaleLineRecord {
  productId: string;
  quantity: number;
  saleId: string;
  unitPrice: number;
}

export interface PaymentRecord {
  amount: number;
  createdAt: string;
  id: string;
  saleId: string;
}

export interface AuditLogRecord {
  action: string;
  actorUserId: string;
  createdAt: string;
  entity: string;
  entityId: string;
  id: string;
  payload: string;
}

export interface ProductState {
  id: string;
  name: string;
  onHandQty: number;
}

export interface MutableSaleStore {
  auditLogs: AuditLogRecord[];
  payments: PaymentRecord[];
  products: Map<string, ProductState>;
  saleItems: Map<string, SaleLineRecord[]>;
  sales: SaleRecord[];
  stockMovements: StockMovementRecord[];
}
