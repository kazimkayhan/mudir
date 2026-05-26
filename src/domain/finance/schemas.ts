import { z } from "zod";

export const expenseWriteSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(1, "validation.nameRequired"),
  currency_code: z.enum(["AFN", "USD"]).optional(),
  note: z.string().optional(),
});

export type ExpenseWriteInput = z.infer<typeof expenseWriteSchema>;

export const supplierWriteSchema = z.object({
  address: z.string().optional(),
  bankDetails: z.string().optional(),
  country: z.string().optional(),
  currency: z.enum(["AFN", "USD"]).optional(),
  email: z.string().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  name: z.string().min(1, "validation.nameRequired"),
  phone: z.string().optional(),
});

export type SupplierWriteInput = z.infer<typeof supplierWriteSchema>;

export const cashSessionOpenSchema = z.object({
  note: z.string().optional(),
  openingBalance: z.number().nonnegative(),
});

export const cashSessionCloseSchema = z.object({
  closingBalance: z.number().nonnegative(),
  sessionId: z.string().min(1),
});
