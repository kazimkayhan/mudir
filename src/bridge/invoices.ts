import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { getBusinessSettings, saveBusinessSettings } from "@/bridge/settings";
import { requireOperatorId } from "@/bridge/users";
import {
  computeInvoiceTotals,
  createInvoiceSchema,
  deriveInvoiceStatus,
  recordInvoicePaymentSchema,
} from "@/domain/invoices/schemas";
import { loadAppDatabase, selectFirstRow } from "@/lib/app-db";
import { appendAuditLog } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";

const invoiceRowSchema = z.object({
  amount_paid: z.coerce.number(),
  balance_due: z.coerce.number(),
  created_at: z.string(),
  currency_code: z.enum(["AFN", "USD"]),
  customer_id: z.string(),
  customer_name: z.string().nullable().optional(),
  discount_amount: z.coerce.number(),
  document_type: z.string(),
  due_date: z.string().nullable(),
  exchange_rate: z.coerce.number(),
  id: z.string(),
  invoice_number: z.string(),
  issue_date: z.string().nullable(),
  notes: z.string().nullable(),
  operator_id: z.string().nullable(),
  status: z.string(),
  subtotal: z.coerce.number(),
  tax_amount: z.coerce.number(),
  total_amount: z.coerce.number(),
  updated_at: z.string(),
});

export type InvoiceRow = z.infer<typeof invoiceRowSchema>;

const INVOICE_SELECT = `SELECT i.id, i.invoice_number, i.document_type, i.customer_id, c.name AS customer_name,
  i.status, i.issue_date, i.due_date, i.currency_code, i.exchange_rate, i.subtotal, i.discount_amount,
  i.tax_amount, i.total_amount, i.amount_paid, i.balance_due, i.notes, i.operator_id, i.created_at, i.updated_at
  FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id`;

export async function listInvoices(limit = 100): Promise<InvoiceRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `${INVOICE_SELECT} ORDER BY i.created_at DESC LIMIT $1`,
    [limit]
  );
  return z.array(invoiceRowSchema).parse(raw);
}

export async function getInvoiceById(id: string): Promise<InvoiceRow | null> {
  if (!isTauri()) {
    return null;
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(`${INVOICE_SELECT} WHERE i.id = $1`, [
    id,
  ]);
  const rows = z.array(invoiceRowSchema).parse(raw);
  return rows[0] ?? null;
}

export async function getInvoiceItems(invoiceId: string) {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `SELECT ii.id, ii.product_id, p.name AS product_name, ii.quantity, ii.unit_price
     FROM invoice_items ii LEFT JOIN products p ON p.id = ii.product_id WHERE ii.invoice_id = $1`,
    [invoiceId]
  );
  return z
    .array(
      z.object({
        id: z.string(),
        product_id: z.string(),
        product_name: z.string().nullable(),
        quantity: z.coerce.number(),
        unit_price: z.coerce.number(),
      })
    )
    .parse(raw);
}

export async function getTotalArOutstanding(): Promise<number> {
  if (!isTauri()) {
    return 0;
  }
  const db = await loadAppDatabase();
  const raw = await selectFirstRow<{ total: number }>(
    db,
    "SELECT COALESCE(SUM(balance_due), 0) AS total FROM invoices WHERE status IN ('issued', 'partial', 'overdue')"
  );
  return raw?.total ?? 0;
}

async function nextInvoiceNumber(documentType: string): Promise<string> {
  const settings = await getBusinessSettings();
  if (documentType === "proforma") {
    const num = settings.nextProformaNumber;
    await saveBusinessSettings({ nextProformaNumber: num + 1 });
    return `${settings.proformaPrefix}${num}`;
  }
  const num = settings.nextInvoiceNumber;
  await saveBusinessSettings({ nextInvoiceNumber: num + 1 });
  return `${settings.invoicePrefix}${num}`;
}

export async function createInvoice(raw: unknown): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = createInvoiceSchema.parse(raw);
  const operatorId = await requireOperatorId();
  const settings = await getBusinessSettings();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const invoiceNumber = await nextInvoiceNumber(input.document_type);
  const { subtotal, total } = computeInvoiceTotals({
    discountAmount: input.discount_amount,
    items: input.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unit_price,
    })),
    taxAmount: input.tax_amount,
  });
  const dueDate =
    input.due_date ??
    new Date(Date.now() + settings.defaultPaymentTermsDays * 86_400_000)
      .toISOString()
      .slice(0, 10);

  await runInTransaction(async (db) => {
    await db.execute(
      `INSERT INTO invoices (id, invoice_number, document_type, customer_id, status, issue_date, due_date,
        currency_code, exchange_rate, subtotal, discount_amount, tax_amount, total_amount, amount_paid, balance_due,
        notes, operator_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'draft', NULL, $5, $6, $7, $8, $9, $10, $11, 0, $11, $12, $13, $14, $14)`,
      [
        id,
        invoiceNumber,
        input.document_type,
        input.customer_id,
        dueDate,
        settings.baseCurrency,
        settings.usdToAfnRate,
        subtotal,
        input.discount_amount,
        input.tax_amount,
        total,
        input.notes ?? null,
        operatorId,
        now,
      ]
    );
    for (const item of input.items) {
      await db.execute(
        "INSERT INTO invoice_items (id, invoice_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)",
        [
          crypto.randomUUID(),
          id,
          item.product_id,
          item.quantity,
          item.unit_price,
        ]
      );
    }
    await appendAuditLog(db, {
      action: "invoice.created",
      actorUserId: operatorId,
      entity: "invoice",
      entityId: id,
    });
  });
  return { id };
}

export async function issueInvoice(invoiceId: string): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const operatorId = await requireOperatorId();
  const now = new Date().toISOString();
  await runInTransaction(async (db) => {
    await db.execute(
      "UPDATE invoices SET status = 'issued', issue_date = $1, updated_at = $2 WHERE id = $3 AND status = 'draft'",
      [now.slice(0, 10), now, invoiceId]
    );
    await appendAuditLog(db, {
      action: "invoice.issued",
      actorUserId: operatorId,
      entity: "invoice",
      entityId: invoiceId,
    });
  });
}

export async function recordInvoicePayment(
  raw: unknown
): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = recordInvoicePaymentSchema.parse(raw);
  const operatorId = await requireOperatorId();
  const invoice = await getInvoiceById(input.invoice_id);
  if (!invoice) {
    throw new Error("validation.invoiceNotFound");
  }
  const paymentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const newPaid = invoice.amount_paid + input.amount;
  const newBalance = Math.max(0, invoice.total_amount - newPaid);
  const status = deriveInvoiceStatus(
    invoice.total_amount,
    newPaid,
    invoice.due_date ?? undefined,
    invoice.status as never
  );

  await runInTransaction(async (db) => {
    await db.execute(
      `INSERT INTO invoice_payments (id, invoice_id, amount, currency_code, exchange_rate, method, payment_date, reference, notes, operator_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        paymentId,
        input.invoice_id,
        input.amount,
        invoice.currency_code,
        invoice.exchange_rate,
        input.method,
        input.payment_date,
        input.reference ?? null,
        input.notes ?? null,
        operatorId,
        now,
      ]
    );
    await db.execute(
      "UPDATE invoices SET amount_paid = $1, balance_due = $2, status = $3, updated_at = $4 WHERE id = $5",
      [newPaid, newBalance, status, now, input.invoice_id]
    );
    await appendAuditLog(db, {
      action: "invoice.payment",
      actorUserId: operatorId,
      entity: "invoice",
      entityId: input.invoice_id,
      payload: JSON.stringify({ amount: input.amount }),
    });
  });
  return { id: paymentId };
}

export async function listInvoicePayments(invoiceId: string) {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, amount, method, payment_date, reference, notes, created_at FROM invoice_payments WHERE invoice_id = $1 ORDER BY payment_date DESC",
    [invoiceId]
  );
  return z
    .array(
      z.object({
        amount: z.coerce.number(),
        created_at: z.string(),
        id: z.string(),
        method: z.string(),
        notes: z.string().nullable(),
        payment_date: z.string(),
        reference: z.string().nullable(),
      })
    )
    .parse(raw);
}

export interface CustomerLedgerRow {
  credit: number;
  date: string;
  debit: number;
  id: string;
  reference: string;
  type: "invoice" | "payment";
}

export async function getCustomerLedger(
  customerId: string
): Promise<CustomerLedgerRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const invoiceRaw = await db.select<unknown>(
    `SELECT id, invoice_number, issue_date, created_at, total_amount, status
     FROM invoices WHERE customer_id = $1 AND status != 'draft' ORDER BY created_at`,
    [customerId]
  );
  const invoices = z
    .array(
      z.object({
        created_at: z.string(),
        id: z.string(),
        invoice_number: z.string(),
        issue_date: z.string().nullable(),
        status: z.string(),
        total_amount: z.coerce.number(),
      })
    )
    .parse(invoiceRaw);

  const paymentRaw = await db.select<unknown>(
    `SELECT ip.id, ip.amount, ip.payment_date, ip.created_at, i.invoice_number
     FROM invoice_payments ip
     JOIN invoices i ON i.id = ip.invoice_id
     WHERE i.customer_id = $1 ORDER BY ip.payment_date`,
    [customerId]
  );
  const payments = z
    .array(
      z.object({
        amount: z.coerce.number(),
        created_at: z.string(),
        id: z.string(),
        invoice_number: z.string(),
        payment_date: z.string(),
      })
    )
    .parse(paymentRaw);

  const rows: CustomerLedgerRow[] = [
    ...invoices.map((invoice) => ({
      credit: 0,
      date: invoice.issue_date ?? invoice.created_at.slice(0, 10),
      debit: invoice.total_amount,
      id: invoice.id,
      reference: invoice.invoice_number,
      type: "invoice" as const,
    })),
    ...payments.map((payment) => ({
      credit: payment.amount,
      date: payment.payment_date,
      debit: 0,
      id: payment.id,
      reference: payment.invoice_number,
      type: "payment" as const,
    })),
  ];

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
