import { z } from "zod";
import { loadAppDatabase } from "@/lib/app-db";
import { isMudirDesktop } from "@/lib/runtime";
import {
  readStoredBusinessSettings,
  writeStoredBusinessSettings,
} from "@/lib/settings-storage";

const settingsRowSchema = z.object({
  address: z.string().nullable(),
  base_currency: z.string(),
  business_registration_number: z.string().nullable().optional(),
  business_type: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  default_locale: z.string(),
  default_payment_terms_days: z.coerce.number().optional(),
  email: z.string().nullable().optional(),
  id: z.string(),
  import_license_number: z.string().nullable().optional(),
  invoice_footer_en: z.string().nullable().optional(),
  invoice_footer_fa: z.string().nullable().optional(),
  invoice_prefix: z.string().nullable().optional(),
  legal_name: z.string().nullable().optional(),
  logo_path: z.string().nullable().optional(),
  next_invoice_number: z.coerce.number().optional(),
  next_proforma_number: z.coerce.number().optional(),
  onboarding_completed: z.coerce.number(),
  payment_receipt_prefix: z.string().nullable().optional(),
  pdf_accent_color: z.string().nullable().optional(),
  phone: z.string().nullable(),
  proforma_prefix: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  signature_path: z.string().nullable().optional(),
  stamp_path: z.string().nullable().optional(),
  stock_deduct_on_invoice: z.string().nullable().optional(),
  store_name: z.string(),
  street_address: z.string().nullable().optional(),
  trade_name: z.string().nullable().optional(),
  updated_at: z.string(),
  usd_to_afn_rate: z.coerce.number(),
  website: z.string().nullable().optional(),
});

export type StockDeductOnInvoice = "issue" | "full_payment";

export interface BusinessSettings {
  address?: string;
  baseCurrency: "AFN" | "USD";
  businessRegistrationNumber?: string;
  businessType: string;
  city?: string;
  defaultLocale: "fa-AF" | "en";
  defaultPaymentTermsDays: number;
  email?: string;
  id: string;
  importLicenseNumber?: string;
  invoiceFooterEn?: string;
  invoiceFooterFa?: string;
  invoicePrefix: string;
  legalName?: string;
  logoPath?: string;
  nextInvoiceNumber: number;
  nextProformaNumber: number;
  onboardingCompleted: boolean;
  paymentReceiptPrefix: string;
  pdfAccentColor: string;
  phone?: string;
  proformaPrefix: string;
  province?: string;
  signaturePath?: string;
  stampPath?: string;
  stockDeductOnInvoice: StockDeductOnInvoice;
  storeName: string;
  streetAddress?: string;
  tradeName?: string;
  updatedAt: string;
  usdToAfnRate: number;
  website?: string;
}

const SETTINGS_SELECT = `SELECT id, store_name, address, phone, default_locale, base_currency, usd_to_afn_rate,
  onboarding_completed, updated_at, legal_name, trade_name, email, website, province, city, street_address,
  import_license_number, business_registration_number, business_type, logo_path, stamp_path, signature_path,
  pdf_accent_color, invoice_footer_fa, invoice_footer_en, invoice_prefix, next_invoice_number,
  proforma_prefix, next_proforma_number, payment_receipt_prefix, default_payment_terms_days,
  stock_deduct_on_invoice FROM business_settings WHERE id = 'default'`;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: field mapping from SQL row
function rowToSettings(
  row: z.infer<typeof settingsRowSchema>
): BusinessSettings {
  const base = {
    address: row.address ?? undefined,
    baseCurrency:
      row.base_currency === "USD" ? ("USD" as const) : ("AFN" as const),
    businessRegistrationNumber: row.business_registration_number ?? undefined,
    businessType: row.business_type ?? "importer_reseller",
    city: row.city ?? undefined,
    defaultLocale:
      row.default_locale === "en" ? ("en" as const) : ("fa-AF" as const),
    defaultPaymentTermsDays: row.default_payment_terms_days ?? 30,
    email: row.email ?? undefined,
    id: row.id,
    importLicenseNumber: row.import_license_number ?? undefined,
    invoiceFooterEn: row.invoice_footer_en ?? undefined,
    invoiceFooterFa: row.invoice_footer_fa ?? undefined,
    invoicePrefix: row.invoice_prefix ?? "INV-",
    legalName: row.legal_name ?? undefined,
    logoPath: row.logo_path ?? undefined,
    nextInvoiceNumber: row.next_invoice_number ?? 1,
    nextProformaNumber: row.next_proforma_number ?? 1,
    onboardingCompleted: row.onboarding_completed === 1,
    paymentReceiptPrefix: row.payment_receipt_prefix ?? "RCP-",
    pdfAccentColor: row.pdf_accent_color ?? "#0891b2",
    phone: row.phone ?? undefined,
    proformaPrefix: row.proforma_prefix ?? "PRO-",
    province: row.province ?? undefined,
    signaturePath: row.signature_path ?? undefined,
    stampPath: row.stamp_path ?? undefined,
    storeName: row.store_name,
    streetAddress: row.street_address ?? undefined,
    tradeName: row.trade_name ?? undefined,
    updatedAt: row.updated_at,
    usdToAfnRate: row.usd_to_afn_rate,
    website: row.website ?? undefined,
  };
  return {
    ...base,
    stockDeductOnInvoice:
      row.stock_deduct_on_invoice === "full_payment" ? "full_payment" : "issue",
  };
}

function settingsToParams(next: BusinessSettings, now: string): unknown[] {
  return [
    next.storeName,
    next.address ?? null,
    next.phone ?? null,
    next.defaultLocale,
    next.baseCurrency,
    next.usdToAfnRate,
    next.onboardingCompleted ? 1 : 0,
    next.legalName ?? null,
    next.tradeName ?? null,
    next.email ?? null,
    next.website ?? null,
    next.province ?? null,
    next.city ?? null,
    next.streetAddress ?? null,
    next.importLicenseNumber ?? null,
    next.businessRegistrationNumber ?? null,
    next.businessType,
    next.logoPath ?? null,
    next.stampPath ?? null,
    next.signaturePath ?? null,
    next.pdfAccentColor,
    next.invoiceFooterFa ?? null,
    next.invoiceFooterEn ?? null,
    next.invoicePrefix,
    next.nextInvoiceNumber,
    next.proformaPrefix,
    next.nextProformaNumber,
    next.paymentReceiptPrefix,
    next.defaultPaymentTermsDays,
    next.stockDeductOnInvoice,
    now,
  ];
}

export const DEFAULT_SETTINGS: BusinessSettings = {
  baseCurrency: "AFN",
  businessType: "importer_reseller",
  defaultLocale: "fa-AF",
  defaultPaymentTermsDays: 30,
  id: "default",
  invoicePrefix: "INV-",
  nextInvoiceNumber: 1,
  nextProformaNumber: 1,
  onboardingCompleted: false,
  paymentReceiptPrefix: "RCP-",
  pdfAccentColor: "#0891b2",
  proformaPrefix: "PRO-",
  stockDeductOnInvoice: "issue",
  storeName: "",
  updatedAt: new Date().toISOString(),
  usdToAfnRate: 70,
};

export async function getBusinessSettings(): Promise<BusinessSettings> {
  if (!isMudirDesktop()) {
    return readStoredBusinessSettings() ?? DEFAULT_SETTINGS;
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(SETTINGS_SELECT);
  const rows = z.array(settingsRowSchema).parse(raw);
  return rows[0] ? rowToSettings(rows[0]) : DEFAULT_SETTINGS;
}

export type BusinessSettingsInput = Partial<Omit<BusinessSettings, "id">>;

async function persistBusinessSettings(
  db: Awaited<ReturnType<typeof loadAppDatabase>>,
  next: BusinessSettings,
  now: string
): Promise<void> {
  const existing = await db.select<unknown>(
    "SELECT id FROM business_settings WHERE id = 'default'"
  );
  const params = settingsToParams(next, now);
  if (Array.isArray(existing) && existing.length > 0) {
    await db.execute(
      `UPDATE business_settings SET
        store_name = $1, address = $2, phone = $3, default_locale = $4, base_currency = $5,
        usd_to_afn_rate = $6, onboarding_completed = $7, legal_name = $8, trade_name = $9,
        email = $10, website = $11, province = $12, city = $13, street_address = $14,
        import_license_number = $15, business_registration_number = $16, business_type = $17,
        logo_path = $18, stamp_path = $19, signature_path = $20, pdf_accent_color = $21,
        invoice_footer_fa = $22, invoice_footer_en = $23, invoice_prefix = $24,
        next_invoice_number = $25, proforma_prefix = $26, next_proforma_number = $27,
        payment_receipt_prefix = $28, default_payment_terms_days = $29,
        stock_deduct_on_invoice = $30, updated_at = $31
      WHERE id = 'default'`,
      params
    );
    return;
  }
  await db.execute(
    `INSERT INTO business_settings (
      id, store_name, address, phone, default_locale, base_currency, usd_to_afn_rate,
      onboarding_completed, legal_name, trade_name, email, website, province, city,
      street_address, import_license_number, business_registration_number, business_type,
      logo_path, stamp_path, signature_path, pdf_accent_color, invoice_footer_fa,
      invoice_footer_en, invoice_prefix, next_invoice_number, proforma_prefix,
      next_proforma_number, payment_receipt_prefix, default_payment_terms_days,
      stock_deduct_on_invoice, updated_at
    ) VALUES (
      'default', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
    )`,
    params
  );
}

export async function saveBusinessSettings(
  input: BusinessSettingsInput
): Promise<void> {
  const current = await getBusinessSettings();
  const now = new Date().toISOString();
  const next: BusinessSettings = {
    ...current,
    ...input,
    id: "default",
    updatedAt: now,
  };

  if (!isMudirDesktop()) {
    writeStoredBusinessSettings(next);
    return;
  }

  const db = await loadAppDatabase();
  await persistBusinessSettings(db, next, now);
}

export async function getSchemaVersion(): Promise<number> {
  if (!isMudirDesktop()) {
    return 0;
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT value FROM schema_meta WHERE key = 'version'"
  );
  const rows = z.array(z.object({ value: z.string() })).parse(raw);
  const v = rows[0]?.value;
  return v ? Number.parseInt(v, 10) : 8;
}
