import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const schemaMeta = sqliteTable("schema_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const businessSettings = sqliteTable("business_settings", {
  address: text("address"),
  baseCurrency: text("base_currency").notNull(),
  defaultLocale: text("default_locale").notNull(),
  id: text("id").primaryKey(),
  onboardingCompleted: integer("onboarding_completed").notNull(),
  phone: text("phone"),
  storeName: text("store_name").notNull(),
  updatedAt: text("updated_at").notNull(),
  usdToAfnRate: real("usd_to_afn_rate").notNull(),
});

export const exchangeRates = sqliteTable("exchange_rates", {
  effectiveAt: text("effective_at").notNull(),
  fromCurrency: text("from_currency").notNull(),
  id: text("id").primaryKey(),
  rate: real("rate").notNull(),
  toCurrency: text("to_currency").notNull(),
});

export const users = sqliteTable("users", {
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  isActive: integer("is_active").notNull(),
  name: text("name").notNull(),
  pinHash: text("pin_hash").notNull(),
  role: text("role").notNull(),
});

/** کالا — موجودی فقط از مسیر stock_movements. */
export const products = sqliteTable("products", {
  barcode: text("barcode"),
  condition: text("condition").notNull().default("new"),
  costPrice: real("cost_price").notNull().default(0),
  createdAt: text("created_at").notNull(),
  currency: text("currency").notNull().default("AFN"),
  id: text("id").primaryKey(),
  isActive: integer("is_active").notNull().default(1),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(0),
  name: text("name").notNull(),
  onHandQty: integer("on_hand_qty").notNull().default(0),
  salePrice: real("sale_price").notNull().default(0),
  sku: text("sku"),
});

export const customers = sqliteTable("customers", {
  address: text("address"),
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  note: text("note"),
  phone: text("phone"),
});

export const stockMovements = sqliteTable("stock_movements", {
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  operatorId: text("operator_id"),
  productId: text("product_id").notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  refId: text("ref_id").notNull(),
  type: text("type").notNull(),
});

export const sales = sqliteTable("sales", {
  cashierId: text("cashier_id").notNull(),
  changeAmount: real("change_amount").notNull(),
  channel: text("channel").notNull().default("in_store"),
  createdAt: text("created_at").notNull(),
  currencyCode: text("currency_code").notNull().default("AFN"),
  customerId: text("customer_id"),
  discountAmount: real("discount_amount").notNull(),
  exchangeRate: real("exchange_rate").notNull().default(1),
  id: text("id").primaryKey(),
  operatorId: text("operator_id"),
  orderId: text("order_id"),
  paidAmount: real("paid_amount").notNull(),
  returnedAt: text("returned_at"),
  subtotal: real("subtotal").notNull(),
  taxAmount: real("tax_amount").notNull(),
  totalAmount: real("total_amount").notNull(),
});

export const saleItems = sqliteTable("sale_items", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  saleId: text("sale_id").notNull(),
  unitPrice: real("unit_price").notNull(),
});

export const payments = sqliteTable("payments", {
  amount: real("amount").notNull(),
  createdAt: text("created_at").notNull(),
  currencyCode: text("currency_code").notNull().default("AFN"),
  id: text("id").primaryKey(),
  method: text("method").notNull().default("cash"),
  saleId: text("sale_id").notNull(),
});

export const onlineOrders = sqliteTable("online_orders", {
  createdAt: text("created_at").notNull(),
  currencyCode: text("currency_code").notNull().default("AFN"),
  customerId: text("customer_id").notNull(),
  deliveryNote: text("delivery_note"),
  exchangeRate: real("exchange_rate").notNull().default(1),
  externalRef: text("external_ref"),
  id: text("id").primaryKey(),
  operatorId: text("operator_id").notNull(),
  saleId: text("sale_id"),
  source: text("source").notNull(),
  status: text("status").notNull(),
  subtotal: real("subtotal").notNull().default(0),
  totalAmount: real("total_amount").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const onlineOrderItems = sqliteTable("online_order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  productId: text("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
});

export const suppliers = sqliteTable("suppliers", {
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
});

export const purchases = sqliteTable("purchases", {
  cashierId: text("cashier_id").notNull(),
  createdAt: text("created_at").notNull(),
  currencyCode: text("currency_code").notNull().default("AFN"),
  exchangeRate: real("exchange_rate").notNull().default(1),
  id: text("id").primaryKey(),
  notes: text("notes"),
  operatorId: text("operator_id"),
  reference: text("reference"),
  supplierId: text("supplier_id"),
  totalCost: real("total_cost").notNull(),
});

export const purchaseLines = sqliteTable("purchase_lines", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  purchaseId: text("purchase_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitCost: real("unit_cost").notNull(),
});

export const expenses = sqliteTable("expenses", {
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  createdAt: text("created_at").notNull(),
  currencyCode: text("currency_code").notNull().default("AFN"),
  exchangeRate: real("exchange_rate").notNull().default(1),
  id: text("id").primaryKey(),
  note: text("note"),
  operatorId: text("operator_id"),
});

export const auditLogs = sqliteTable("audit_logs", {
  action: text("action").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  createdAt: text("created_at").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  id: text("id").primaryKey(),
  payload: text("payload"),
});

export type ProductRow = typeof products.$inferSelect;
export type CustomerRow = typeof customers.$inferSelect;
export type OnlineOrderRow = typeof onlineOrders.$inferSelect;
