import { z } from "zod";

export const purchaseLineSchema = z.object({
  expiryDate: z.string().optional(),
  lotNumber: z.string().optional(),
  productId: z.string().min(1, "validation.productRequired"),
  quantity: z.number().int().positive(),
  serialNumbers: z.array(z.string()).optional(),
  unitCost: z.number().nonnegative(),
});

export const recordPurchaseSchema = z.object({
  cashierId: z.string().min(1).optional(),
  currency_code: z.enum(["AFN", "USD"]).optional(),
  lines: z.array(purchaseLineSchema).min(1),
  notes: z.string().optional(),
  reference: z.string().optional(),
  supplierId: z.string().min(1).optional(),
});

export type RecordPurchaseInput = z.infer<typeof recordPurchaseSchema>;

export function purchaseLinesTotalCost(
  lines: { quantity: number; unitCost: number }[]
): number {
  return lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
}
