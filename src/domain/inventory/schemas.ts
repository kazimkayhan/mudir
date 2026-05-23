import { z } from "zod";

export const manualStockMovementTypeSchema = z.enum([
  "sale",
  "return",
  "adjustment",
  "purchase",
]);

export const stockMovementTypeSchema = z.enum([
  ...manualStockMovementTypeSchema.options,
  "opening",
]);

/** ثبت یک حرکت انبار؛ `quantity_delta` مثبت = ورود، منفی = خروج. */
export const applyMovementSchema = z.object({
  product_id: z.string().min(1, "validation.productRequired"),
  quantity_delta: z
    .number()
    .int()
    .refine((n) => n !== 0, "validation.deltaNonZero"),
  ref_id: z.string().min(1, "validation.refRequired"),
  type: manualStockMovementTypeSchema,
});

export type ApplyMovementInput = z.infer<typeof applyMovementSchema>;

export const inventoryFormSchema = z
  .object({
    /** فقط برای adjustment: می‌تواند منفی باشد */
    adjustmentDelta: z.number().int().optional(),
    movementType: manualStockMovementTypeSchema,
    productId: z.string().min(1, "validation.productRequired"),
    /** برای purchase / sale / return: مقدار مثبت */
    qty: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.movementType === "adjustment") {
      if (data.adjustmentDelta === undefined || data.adjustmentDelta === 0) {
        ctx.addIssue({
          code: "custom",
          message: "validation.adjustmentNonZero",
          path: ["adjustmentDelta"],
        });
      }
    } else if (data.qty === undefined || data.qty <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "validation.qtyPositive",
        path: ["qty"],
      });
    }
  });

export type InventoryFormValues = z.infer<typeof inventoryFormSchema>;

export function formValuesToDelta(values: InventoryFormValues): number {
  switch (values.movementType) {
    case "purchase":
    case "return":
      return values.qty ?? 0;
    case "sale":
      return -(values.qty ?? 0);
    case "adjustment":
      return values.adjustmentDelta ?? 0;
    default:
      return 0;
  }
}
