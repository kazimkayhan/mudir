import { z } from "zod";

/** ورودی ایجاد/ویرایش محصول (پس از submit فرم). */
export const productWriteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(200, "Max 200 characters"),
  sku: z.string().max(80, "Max 80 characters"),
  on_hand_qty: z.number().int().min(0, "Must be ≥ 0"),
});

export type ProductWriteInput = z.infer<typeof productWriteSchema>;

export const productUpdateSchema = productWriteSchema.extend({
  id: z.string().min(1, "Product id required"),
});

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export function normalizeSku(sku: string): string | null {
  const t = sku.trim();
  return t.length > 0 ? t : null;
}
