import { getBackupStatus } from "@/bridge/backup";
import { loadAppDatabase, selectFirstRow } from "@/lib/app-db";
import { isMudirDesktop } from "@/lib/runtime";

export interface OnboardingProgress {
  backupToday: boolean;
  customerCount: number;
  invoiceCount: number;
  paymentCount: number;
  productCount: number;
  saleCount: number;
}

export async function getOnboardingProgress(): Promise<OnboardingProgress> {
  if (!isMudirDesktop()) {
    return {
      backupToday: false,
      customerCount: 0,
      invoiceCount: 0,
      paymentCount: 0,
      productCount: 0,
      saleCount: 0,
    };
  }

  const db = await loadAppDatabase();
  const [products, customers, invoices, payments, sales, backup] =
    await Promise.all([
      selectFirstRow<{ count: number }>(
        db,
        "SELECT COUNT(*) AS count FROM products WHERE is_active = 1"
      ),
      selectFirstRow<{ count: number }>(
        db,
        "SELECT COUNT(*) AS count FROM customers WHERE is_active = 1"
      ),
      selectFirstRow<{ count: number }>(
        db,
        "SELECT COUNT(*) AS count FROM invoices"
      ),
      selectFirstRow<{ count: number }>(
        db,
        "SELECT COUNT(*) AS count FROM invoice_payments"
      ),
      selectFirstRow<{ count: number }>(
        db,
        "SELECT COUNT(*) AS count FROM sales"
      ),
      getBackupStatus(),
    ]);

  return {
    backupToday: backup?.todayExists ?? false,
    customerCount: customers?.count ?? 0,
    invoiceCount: invoices?.count ?? 0,
    paymentCount: payments?.count ?? 0,
    productCount: products?.count ?? 0,
    saleCount: sales?.count ?? 0,
  };
}
