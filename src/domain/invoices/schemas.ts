import { z } from "zod";

export const INVOICE_STATUSES = [
  "draft",
  "issued",
  "partial",
  "paid",
  "overdue",
  "void",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const DOCUMENT_TYPES = ["invoice", "proforma", "credit_note"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const invoiceItemSchema = z.object({
  product_id: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price: z.number().min(0),
});

export const createInvoiceSchema = z.object({
  customer_id: z.string().min(1),
  discount_amount: z.number().min(0).default(0),
  document_type: z.enum(DOCUMENT_TYPES).default("invoice"),
  due_date: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1),
  notes: z.string().optional(),
  tax_amount: z.number().min(0).default(0),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const recordInvoicePaymentSchema = z.object({
  amount: z.number().positive(),
  invoice_id: z.string().min(1),
  method: z.enum(["cash", "card", "bank_transfer", "hawala"]).default("cash"),
  notes: z.string().optional(),
  payment_date: z.string(),
  reference: z.string().optional(),
});

export type RecordInvoicePaymentInput = z.infer<
  typeof recordInvoicePaymentSchema
>;

export function computeInvoiceTotals(input: {
  discountAmount: number;
  items: { quantity: number; unitPrice: number }[];
  taxAmount: number;
}): { subtotal: number; total: number } {
  const subtotal = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const total = Math.max(0, subtotal - input.discountAmount + input.taxAmount);
  return { subtotal, total };
}

export function deriveInvoiceStatus(
  total: number,
  amountPaid: number,
  dueDate: string | undefined,
  currentStatus: InvoiceStatus
): InvoiceStatus {
  if (currentStatus === "void" || currentStatus === "draft") {
    return currentStatus;
  }
  const balance = total - amountPaid;
  if (balance <= 0) {
    return "paid";
  }
  if (amountPaid > 0) {
    if (dueDate && new Date(dueDate).getTime() < Date.now()) {
      return "overdue";
    }
    return "partial";
  }
  if (dueDate && new Date(dueDate).getTime() < Date.now()) {
    return "overdue";
  }
  return "issued";
}

export function computeArAgingBucket(dueDate: string | undefined): string {
  if (!dueDate) {
    return "current";
  }
  const days = Math.floor(
    (Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days <= 0) {
    return "current";
  }
  if (days <= 30) {
    return "1-30";
  }
  if (days <= 60) {
    return "31-60";
  }
  if (days <= 90) {
    return "61-90";
  }
  return "90+";
}
