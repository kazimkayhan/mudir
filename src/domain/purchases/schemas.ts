import { z } from "zod";

export const purchaseLineSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
});

export const recordPurchaseSchema = z.object({
  supplierId: z.string().min(1).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  cashierId: z.string().min(1, "Cashier is required"),
  lines: z.array(purchaseLineSchema).min(1, "At least one line"),
});

export type RecordPurchaseInput = z.infer<typeof recordPurchaseSchema>;

export function purchaseLinesTotalCost(
  lines: { quantity: number; unitCost: number }[],
): number {
  return lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
}
