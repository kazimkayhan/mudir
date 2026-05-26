import { listCustomers } from "@/bridge/customers";
import { listProducts } from "@/bridge/products";
import { listSuppliers } from "@/bridge/suppliers";
import { downloadCsv, rowsToCsv } from "@/domain/export/csv";

function datedFileName(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function exportProductsCsv(): Promise<void> {
  const products = await listProducts(false);
  const csv = rowsToCsv(
    ["code", "name", "cost_price", "sale_price", "qty", "currency"],
    products.map((p) => [
      p.sku ?? p.barcode ?? "",
      p.name,
      p.cost_price,
      p.sale_price,
      p.on_hand_qty,
      p.currency,
    ])
  );
  downloadCsv(datedFileName("mudir-products"), csv);
}

export async function exportCustomersCsv(): Promise<void> {
  const customers = await listCustomers();
  const csv = rowsToCsv(
    [
      "name",
      "phone",
      "business_name",
      "license_number",
      "city",
      "email",
      "credit_limit",
      "address",
      "note",
    ],
    customers.map((c) => [
      c.name,
      c.phone,
      c.business_name,
      c.license_number,
      c.city,
      c.email,
      c.credit_limit,
      c.address,
      c.note,
    ])
  );
  downloadCsv(datedFileName("mudir-customers"), csv);
}

export async function exportSuppliersCsv(): Promise<void> {
  const suppliers = await listSuppliers();
  const csv = rowsToCsv(
    [
      "name",
      "phone",
      "country",
      "currency",
      "email",
      "address",
      "lead_time_days",
      "bank_details",
    ],
    suppliers.map((s) => [
      s.name,
      s.phone,
      s.country,
      s.currency,
      s.email,
      s.address,
      s.lead_time_days,
      s.bank_details,
    ])
  );
  downloadCsv(datedFileName("mudir-suppliers"), csv);
}
