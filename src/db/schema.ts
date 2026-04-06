import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** کالا — ترجیح: تغییر موجودی از مسیر `stock_movements`. */
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku"),
  onHandQty: integer("on_hand_qty").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const stockMovements = sqliteTable("stock_movements", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  type: text("type").notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  refId: text("ref_id").notNull(),
  createdAt: text("created_at").notNull(),
});

/** فروش POS — هم‌تراز با migration v5 در Rust. */
export const sales = sqliteTable("sales", {
  id: text("id").primaryKey(),
  cashierId: text("cashier_id").notNull(),
  customerId: text("customer_id"),
  subtotal: real("subtotal").notNull(),
  discountAmount: real("discount_amount").notNull(),
  taxAmount: real("tax_amount").notNull(),
  totalAmount: real("total_amount").notNull(),
  paidAmount: real("paid_amount").notNull(),
  changeAmount: real("change_amount").notNull(),
  createdAt: text("created_at").notNull(),
  returnedAt: text("returned_at"),
});

export const saleItems = sqliteTable("sale_items", {
  id: text("id").primaryKey(),
  saleId: text("sale_id").notNull(),
  productId: text("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  saleId: text("sale_id").notNull(),
  amount: real("amount").notNull(),
  createdAt: text("created_at").notNull(),
});

export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  createdAt: text("created_at").notNull(),
});

export const purchases = sqliteTable("purchases", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id"),
  reference: text("reference"),
  totalCost: real("total_cost").notNull(),
  notes: text("notes"),
  cashierId: text("cashier_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const purchaseLines = sqliteTable("purchase_lines", {
  id: text("id").primaryKey(),
  purchaseId: text("purchase_id").notNull(),
  productId: text("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitCost: real("unit_cost").notNull(),
});

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const cashSessions = sqliteTable("cash_sessions", {
  id: text("id").primaryKey(),
  openedAt: text("opened_at").notNull(),
  closedAt: text("closed_at"),
  openingBalance: real("opening_balance").notNull(),
  closingBalance: real("closing_balance"),
  note: text("note"),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  payload: text("payload"),
  createdAt: text("created_at").notNull(),
});

export type ProductRow = typeof products.$inferSelect;
export type NewProductRow = typeof products.$inferInsert;
export type StockMovementRow = typeof stockMovements.$inferSelect;
