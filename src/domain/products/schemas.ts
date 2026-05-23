import { z } from "zod";

export const PRODUCT_CONDITIONS = ["new", "used"] as const;
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];

export const productWriteSchema = z.object({
  barcode: z.string().max(80).optional(),
  condition: z.enum(PRODUCT_CONDITIONS),
  cost_price: z.number().min(0, "validation.amountPositive"),
  currency: z.enum(["AFN", "USD"]),
  low_stock_threshold: z.number().int().min(0, "validation.qtyMinZero"),
  name: z.string().trim().min(1, "validation.nameRequired").max(200),
  opening_qty: z.number().int().min(0, "validation.qtyMinZero").optional(),
  sale_price: z.number().min(0, "validation.amountPositive"),
  sku: z.string().max(80),
});

export type ProductWriteInput = z.infer<typeof productWriteSchema>;

export const productUpdateSchema = productWriteSchema.extend({
  id: z.string().min(1),
});

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export function normalizeSku(sku: string): string | null {
  const t = sku.trim();
  return t.length > 0 ? t : null;
}

export function normalizeBarcode(barcode?: string): string | null {
  if (!barcode) {
    return null;
  }
  const t = barcode.trim();
  return t.length > 0 ? t : null;
}
