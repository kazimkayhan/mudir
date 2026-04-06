import { z } from "zod";

export const stockMovementTypeSchema = z.enum([
  "sale",
  "return",
  "adjustment",
  "purchase",
]);

/** ثبت یک حرکت انبار؛ `quantity_delta` مثبت = ورود، منفی = خروج. */
export const applyMovementSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  type: stockMovementTypeSchema,
  quantity_delta: z
    .number()
    .int()
    .refine((n) => n !== 0, "Delta cannot be zero"),
  ref_id: z.string().min(1, "Reference id is required"),
});

export type ApplyMovementInput = z.infer<typeof applyMovementSchema>;

export const inventoryFormSchema = z
  .object({
    productId: z.string().min(1, "Product is required"),
    movementType: stockMovementTypeSchema,
    /** برای purchase / sale / return: مقدار مثبت */
    qty: z.number().int().positive().optional(),
    /** فقط برای adjustment: می‌تواند منفی باشد */
    adjustmentDelta: z.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.movementType === "adjustment") {
      if (data.adjustmentDelta === undefined || data.adjustmentDelta === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a non-zero adjustment",
          path: ["adjustmentDelta"],
        });
      }
    } else if (data.qty === undefined || data.qty <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a positive quantity",
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
  }
}
