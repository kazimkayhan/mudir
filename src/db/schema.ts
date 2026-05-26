import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const schemaMeta = sqliteTable("schema_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const businessSettings = sqliteTable("business_settings", {
  address: text("address"),
  baseCurrency: text("base_currency").notNull().default("AFN"),
  businessRegistrationNumber: text("business_registration_number"),
  businessType: text("business_type").notNull().default("importer_reseller"),
  city: text("city"),
  defaultLocale: text("default_locale").notNull().default("fa-AF"),
  defaultPaymentTermsDays: integer("default_payment_terms_days")
    .notNull()
    .default(30),
  email: text("email"),
  id: text("id").primaryKey(),
  importLicenseNumber: text("import_license_number"),
  invoiceFooterEn: text("invoice_footer_en"),
  invoiceFooterFa: text("invoice_footer_fa"),
  invoicePrefix: text("invoice_prefix").default("INV-"),
  legalName: text("legal_name"),
  logoPath: text("logo_path"),
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
  nextProformaNumber: integer("next_proforma_number").notNull().default(1),
  onboardingCompleted: integer("onboarding_completed").notNull().default(0),
  paymentReceiptPrefix: text("payment_receipt_prefix").default("RCP-"),
  pdfAccentColor: text("pdf_accent_color").default("#0891b2"),
  phone: text("phone"),
  proformaPrefix: text("proforma_prefix").default("PRO-"),
  province: text("province"),
  signaturePath: text("signature_path"),
  stampPath: text("stamp_path"),
  stockDeductOnInvoice: text("stock_deduct_on_invoice")
    .notNull()
    .default("issue"),
  storeName: text("store_name").notNull().default(""),
  streetAddress: text("street_address"),
  tradeName: text("trade_name"),
  updatedAt: text("updated_at").notNull(),
  usdToAfnRate: real("usd_to_afn_rate").notNull().default(70),
  website: text("website"),
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
  email: text("email"),
  id: text("id").primaryKey(),
  isActive: integer("is_active").notNull().default(1),
  lastLoginAt: text("last_login_at"),
  mustChangePassword: integer("must_change_password").notNull().default(0),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  pinHash: text("pin_hash").notNull(),
  role: text("role").notNull(),
});

/** کالا — موجودی فقط از مسیر stock_movements. */
export const products = sqliteTable("products", {
  barcode: text("barcode"),
  brandId: text("brand_id"),
  categoryId: text("category_id"),
  condition: text("condition").notNull().default("new"),
  costPrice: real("cost_price").notNull().default(0),
  countryOfOrigin: text("country_of_origin"),
  createdAt: text("created_at").notNull(),
  currency: text("currency").notNull().default("AFN"),
  defaultDutyRate: real("default_duty_rate"),
  description: text("description"),
  hsCode: text("hs_code"),
  id: text("id").primaryKey(),
  isActive: integer("is_active").notNull().default(1),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(0),
  manufacturerId: text("manufacturer_id"),
  minSaleQty: integer("min_sale_qty").notNull().default(1),
  modelNumber: text("model_number"),
  name: text("name").notNull(),
  onHandQty: integer("on_hand_qty").notNull().default(0),
  productType: text("product_type").notNull().default("consumable"),
  requiresLicense: integer("requires_license").notNull().default(0),
  salePrice: real("sale_price").notNull().default(0),
  sku: text("sku"),
  specsJson: text("specs_json"),
  trackingMode: text("tracking_mode").notNull().default("none"),
  unitOfMeasure: text("unit_of_measure").notNull().default("piece"),
  warrantyMonths: integer("warranty_months"),
});

export const productCategories = sqliteTable("product_categories", {
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameFa: text("name_fa").notNull(),
  parentId: text("parent_id"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const brands = sqliteTable("brands", {
  country: text("country"),
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
});

export const manufacturers = sqliteTable("manufacturers", {
  country: text("country"),
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const customers = sqliteTable("customers", {
  address: text("address"),
  businessName: text("business_name"),
  city: text("city"),
  contactPerson: text("contact_person"),
  createdAt: text("created_at").notNull(),
  creditLimit: real("credit_limit"),
  customerType: text("customer_type").default("other"),
  defaultDiscountPct: real("default_discount_pct").notNull().default(0),
  email: text("email"),
  id: text("id").primaryKey(),
  isActive: integer("is_active").notNull().default(1),
  licenseNumber: text("license_number"),
  name: text("name").notNull(),
  note: text("note"),
  paymentTermsDays: integer("payment_terms_days"),
  phone: text("phone"),
  preferredCurrency: text("preferred_currency").default("AFN"),
  province: text("province"),
  specialty: text("specialty"),
  streetAddress: text("street_address"),
  taxId: text("tax_id"),
});

export const stockMovements = sqliteTable("stock_movements", {
  batchId: text("batch_id"),
  createdAt: text("created_at").notNull(),
  id: text("id").primaryKey(),
  operatorId: text("operator_id"),
  productId: text("product_id").notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  refId: text("ref_id").notNull(),
  type: text("type").notNull(),
});

export const inventoryBatches = sqliteTable("inventory_batches", {
  expiryDate: text("expiry_date"),
  id: text("id").primaryKey(),
  lotNumber: text("lot_number"),
  notes: text("notes"),
  productId: text("product_id").notNull(),
  purchaseLineId: text("purchase_line_id"),
  qtyOnHand: integer("qty_on_hand").notNull().default(0),
  receivedAt: text("received_at").notNull(),
  serialNumber: text("serial_number"),
  status: text("status").notNull().default("available"),
  unitCost: real("unit_cost").notNull().default(0),
});

export const saleItemBatches = sqliteTable("sale_item_batches", {
  batchId: text("batch_id").notNull(),
  id: text("id").primaryKey(),
  quantity: integer("quantity").notNull().default(1),
  saleItemId: text("sale_item_id").notNull(),
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

export const cashSessions = sqliteTable("cash_sessions", {
  closedAt: text("closed_at"),
  closingBalance: real("closing_balance"),
  id: text("id").primaryKey(),
  note: text("note"),
  openedAt: text("opened_at").notNull(),
  openingBalance: real("opening_balance").notNull().default(0),
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
  address: text("address"),
  bankDetails: text("bank_details"),
  country: text("country"),
  createdAt: text("created_at").notNull(),
  currency: text("currency").default("USD"),
  email: text("email"),
  id: text("id").primaryKey(),
  leadTimeDays: integer("lead_time_days"),
  name: text("name").notNull(),
  phone: text("phone"),
});

export const purchases = sqliteTable("purchases", {
  amountPaid: real("amount_paid").notNull().default(0),
  balanceDue: real("balance_due").notNull().default(0),
  cashierId: text("cashier_id").notNull(),
  createdAt: text("created_at").notNull(),
  currencyCode: text("currency_code").notNull().default("AFN"),
  dueDate: text("due_date"),
  exchangeRate: real("exchange_rate").notNull().default(1),
  id: text("id").primaryKey(),
  importShipmentId: text("import_shipment_id"),
  notes: text("notes"),
  operatorId: text("operator_id"),
  reference: text("reference"),
  status: text("status").notNull().default("received"),
  supplierId: text("supplier_id"),
  supplierInvoiceRef: text("supplier_invoice_ref"),
  totalCost: real("total_cost").notNull(),
});

export const purchaseLines = sqliteTable("purchase_lines", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  purchaseId: text("purchase_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitCost: real("unit_cost").notNull(),
});

export const purchasePayments = sqliteTable("purchase_payments", {
  amount: real("amount").notNull(),
  createdAt: text("created_at").notNull(),
  currencyCode: text("currency_code").notNull().default("USD"),
  exchangeRate: real("exchange_rate").notNull().default(1),
  id: text("id").primaryKey(),
  method: text("method").notNull().default("bank_transfer"),
  notes: text("notes"),
  operatorId: text("operator_id"),
  paymentDate: text("payment_date").notNull(),
  purchaseId: text("purchase_id").notNull(),
  reference: text("reference"),
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

export const invoices = sqliteTable("invoices", {
  amountPaid: real("amount_paid").notNull().default(0),
  balanceDue: real("balance_due").notNull().default(0),
  createdAt: text("created_at").notNull(),
  currencyCode: text("currency_code").notNull().default("AFN"),
  customerId: text("customer_id").notNull(),
  discountAmount: real("discount_amount").notNull().default(0),
  documentType: text("document_type").notNull().default("invoice"),
  dueDate: text("due_date"),
  exchangeRate: real("exchange_rate").notNull().default(1),
  id: text("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  issueDate: text("issue_date"),
  notes: text("notes"),
  operatorId: text("operator_id"),
  saleId: text("sale_id"),
  status: text("status").notNull().default("draft"),
  subtotal: real("subtotal").notNull().default(0),
  taxAmount: real("tax_amount").notNull().default(0),
  termsText: text("terms_text"),
  totalAmount: real("total_amount").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const invoiceItems = sqliteTable("invoice_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  productId: text("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
});

export const invoicePayments = sqliteTable("invoice_payments", {
  amount: real("amount").notNull(),
  createdAt: text("created_at").notNull(),
  currencyCode: text("currency_code").notNull().default("AFN"),
  exchangeRate: real("exchange_rate").notNull().default(1),
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  method: text("method").notNull().default("cash"),
  notes: text("notes"),
  operatorId: text("operator_id"),
  paymentDate: text("payment_date").notNull(),
  reference: text("reference"),
});

export const invoiceItemBatches = sqliteTable("invoice_item_batches", {
  batchId: text("batch_id").notNull(),
  id: text("id").primaryKey(),
  invoiceItemId: text("invoice_item_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
});

export const importShipments = sqliteTable("import_shipments", {
  arrivalDate: text("arrival_date"),
  clearanceFees: real("clearance_fees").notNull().default(0),
  createdAt: text("created_at").notNull(),
  currencyCode: text("currency_code").notNull().default("USD"),
  customsDeclarationNo: text("customs_declaration_no"),
  customsDuty: real("customs_duty").notNull().default(0),
  exchangeRate: real("exchange_rate").notNull().default(1),
  foreignInvoiceRef: text("foreign_invoice_ref"),
  freightCost: real("freight_cost").notNull().default(0),
  id: text("id").primaryKey(),
  insuranceCost: real("insurance_cost").notNull().default(0),
  notes: text("notes"),
  originCountry: text("origin_country"),
  otherCosts: real("other_costs").notNull().default(0),
  reference: text("reference").notNull(),
  status: text("status").notNull().default("in_transit"),
  supplierId: text("supplier_id"),
  updatedAt: text("updated_at").notNull(),
});

export const importShipmentPayments = sqliteTable("import_shipment_payments", {
  amount: real("amount").notNull(),
  createdAt: text("created_at").notNull(),
  currencyCode: text("currency_code").notNull().default("USD"),
  exchangeRate: real("exchange_rate").notNull().default(1),
  id: text("id").primaryKey(),
  importShipmentId: text("import_shipment_id").notNull(),
  method: text("method").notNull().default("bank_transfer"),
  notes: text("notes"),
  operatorId: text("operator_id"),
  paymentDate: text("payment_date").notNull(),
  reference: text("reference"),
});

export const productKitItems = sqliteTable("product_kit_items", {
  componentProductId: text("component_product_id").notNull(),
  id: text("id").primaryKey(),
  kitProductId: text("kit_product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
});

export const productRelated = sqliteTable("product_related", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  relatedProductId: text("related_product_id").notNull(),
  relationType: text("relation_type").notNull().default("accessory"),
});

export const productDocuments = sqliteTable("product_documents", {
  createdAt: text("created_at").notNull(),
  docType: text("doc_type").notNull(),
  filePath: text("file_path").notNull(),
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  title: text("title").notNull(),
});

export const productImages = sqliteTable("product_images", {
  createdAt: text("created_at").notNull(),
  filePath: text("file_path").notNull(),
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type ProductRow = typeof products.$inferSelect;
export type CustomerRow = typeof customers.$inferSelect;
export type OnlineOrderRow = typeof onlineOrders.$inferSelect;
