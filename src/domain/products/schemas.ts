import { z } from "zod";

export const PRODUCT_TYPES = [
  "machine",
  "consumable",
  "spare_part",
  "accessory",
  "kit",
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const TRACKING_MODES = ["none", "serial", "lot", "lot_expiry"] as const;
export type TrackingMode = (typeof TRACKING_MODES)[number];

export const PRODUCT_CONDITIONS = ["new", "used"] as const;
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];

export const productWriteSchema = z
  .object({
    barcode: z.string().max(80).optional(),
    brand_id: z.string().optional(),
    category_id: z.string().optional(),
    condition: z.enum(PRODUCT_CONDITIONS),
    cost_price: z.number().min(0, "validation.amountPositive"),
    country_of_origin: z.string().max(80).optional(),
    currency: z.enum(["AFN", "USD"]),
    default_duty_rate: z.number().min(0).optional(),
    description: z.string().max(5000).optional(),
    hs_code: z.string().max(40).optional(),
    low_stock_threshold: z.number().int().min(0, "validation.qtyMinZero"),
    manufacturer_id: z.string().optional(),
    min_sale_qty: z.number().int().min(1).default(1),
    model_number: z.string().max(80).optional(),
    name: z.string().trim().min(1, "validation.nameRequired").max(200),
    opening_qty: z.number().int().min(0, "validation.qtyMinZero").optional(),
    product_type: z.enum(PRODUCT_TYPES).default("consumable"),
    requires_license: z.boolean().default(false),
    sale_price: z.number().min(0, "validation.amountPositive"),
    sku: z.string().max(80),
    specs_json: z.string().optional(),
    tracking_mode: z.enum(TRACKING_MODES).default("none"),
    unit_of_measure: z.string().max(20).default("piece"),
    warranty_months: z.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.product_type === "machine" && data.tracking_mode !== "serial") {
      ctx.addIssue({
        code: "custom",
        message: "validation.machineRequiresSerial",
        path: ["tracking_mode"],
      });
    }
  });

export type ProductWriteFormInput = z.input<typeof productWriteSchema>;
export type ProductWriteInput = z.output<typeof productWriteSchema>;

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
