import { z } from "zod";

export const expenseWriteSchema = z.object({
  category: z.string().min(1, "Category is required"),
  amount: z.number().positive(),
  note: z.string().optional(),
});

export type ExpenseWriteInput = z.infer<typeof expenseWriteSchema>;

export const supplierWriteSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
});

export type SupplierWriteInput = z.infer<typeof supplierWriteSchema>;

export const cashSessionOpenSchema = z.object({
  openingBalance: z.number().nonnegative(),
  note: z.string().optional(),
});

export const cashSessionCloseSchema = z.object({
  sessionId: z.string().min(1),
  closingBalance: z.number().nonnegative(),
});
