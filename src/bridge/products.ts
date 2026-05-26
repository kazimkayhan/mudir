import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { requireOperatorId } from "@/bridge/users";
import {
  normalizeBarcode,
  normalizeSku,
  type ProductWriteInput,
  productUpdateSchema,
  productWriteSchema,
} from "@/domain/products/schemas";
import { loadAppDatabase } from "@/lib/app-db";
import { appendAuditLog } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";
import { adjustProductStock, productHasReferences } from "@/lib/stock";

export const productRowSchema = z.object({
  barcode: z.string().nullable().optional(),
  brand_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  condition: z.enum(["new", "used"]).default("new"),
  cost_price: z.coerce.number().default(0),
  country_of_origin: z.string().nullable().optional(),
  created_at: z.string(),
  currency: z.string().default("AFN"),
  default_duty_rate: z.coerce.number().nullable().optional(),
  description: z.string().nullable().optional(),
  hs_code: z.string().nullable().optional(),
  id: z.string(),
  is_active: z.coerce.number().default(1),
  low_stock_threshold: z.coerce.number().default(0),
  manufacturer_id: z.string().nullable().optional(),
  min_sale_qty: z.coerce.number().default(1),
  model_number: z.string().nullable().optional(),
  name: z.string(),
  on_hand_qty: z.coerce.number(),
  product_type: z.string().default("consumable"),
  requires_license: z.coerce.number().default(0),
  sale_price: z.coerce.number().default(0),
  sku: z.string().nullable(),
  specs_json: z.string().nullable().optional(),
  tracking_mode: z.string().default("none"),
  unit_of_measure: z.string().default("piece"),
  warranty_months: z.coerce.number().nullable().optional(),
});

export type ProductRow = z.infer<typeof productRowSchema>;

const PRODUCT_SELECT = `SELECT id, name, sku, barcode, on_hand_qty, sale_price, cost_price, currency, condition,
  low_stock_threshold, is_active, created_at, product_type, category_id, brand_id, manufacturer_id, model_number,
  country_of_origin, tracking_mode, unit_of_measure, warranty_months, hs_code, default_duty_rate, description,
  specs_json, requires_license, min_sale_qty FROM products`;

function catalogValues(input: ProductWriteInput) {
  return [
    input.product_type,
    input.category_id ?? null,
    input.brand_id ?? null,
    input.manufacturer_id ?? null,
    input.model_number ?? null,
    input.country_of_origin ?? null,
    input.tracking_mode,
    input.unit_of_measure,
    input.warranty_months ?? null,
    input.hs_code ?? null,
    input.default_duty_rate ?? null,
    input.description ?? null,
    input.specs_json ?? null,
    input.requires_license ? 1 : 0,
    input.min_sale_qty,
  ];
}

export async function listProducts(activeOnly = true): Promise<ProductRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const sql = activeOnly
    ? `${PRODUCT_SELECT} WHERE is_active = 1 ORDER BY name COLLATE NOCASE`
    : `${PRODUCT_SELECT} ORDER BY name COLLATE NOCASE`;
  const raw = await db.select<unknown>(sql);
  return z.array(productRowSchema).parse(raw);
}

export async function findProductBySkuOrBarcode(
  code: string
): Promise<ProductRow | null> {
  if (!isTauri()) {
    return null;
  }
  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `${PRODUCT_SELECT} WHERE is_active = 1 AND (sku = $1 OR barcode = $1) LIMIT 1`,
    [trimmed]
  );
  const rows = z.array(productRowSchema).parse(raw);
  return rows[0] ?? null;
}

export async function listLowStockProducts(): Promise<ProductRow[]> {
  const all = await listProducts();
  return all.filter(
    (p) => p.low_stock_threshold > 0 && p.on_hand_qty <= p.low_stock_threshold
  );
}

export async function insertProduct(raw: unknown): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = productWriteSchema.parse(raw);
  const operatorId = await requireOperatorId();
  const id = crypto.randomUUID();
  const sku = normalizeSku(input.sku);
  const barcode = normalizeBarcode(input.barcode);
  const now = new Date().toISOString();
  const openingQty = input.opening_qty ?? 0;

  await runInTransaction(async (db) => {
    if (sku) {
      const dup = await db.select<unknown>(
        "SELECT id FROM products WHERE sku = $1 LIMIT 1",
        [sku]
      );
      if (Array.isArray(dup) && dup.length > 0) {
        throw new Error("validation.skuDuplicate");
      }
    }
    await db.execute(
      `INSERT INTO products (id, name, sku, barcode, on_hand_qty, sale_price, cost_price, currency, condition,
        low_stock_threshold, is_active, created_at, product_type, category_id, brand_id, manufacturer_id,
        model_number, country_of_origin, tracking_mode, unit_of_measure, warranty_months, hs_code,
        default_duty_rate, description, specs_json, requires_license, min_sale_qty)
       VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, 1, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
      [
        id,
        input.name,
        sku,
        barcode,
        input.sale_price,
        input.cost_price,
        input.currency,
        input.condition,
        input.low_stock_threshold,
        now,
        ...catalogValues(input),
      ]
    );
    if (openingQty > 0) {
      const movId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO stock_movements (id, product_id, type, quantity_delta, ref_id, operator_id, created_at)
         VALUES ($1, $2, 'opening', $3, $4, $5, $6)`,
        [movId, id, openingQty, id, operatorId, now]
      );
      await adjustProductStock(db, id, openingQty);
    }
    await appendAuditLog(db, {
      action: "product.created",
      actorUserId: operatorId,
      entity: "product",
      entityId: id,
      payload: JSON.stringify({ name: input.name }),
    });
  });
  return { id };
}

export async function updateProduct(raw: unknown): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = productUpdateSchema.parse(raw);
  const operatorId = await requireOperatorId();
  const sku = normalizeSku(input.sku);
  const barcode = normalizeBarcode(input.barcode);
  const db = await loadAppDatabase();

  if (sku) {
    const dup = await db.select<unknown>(
      "SELECT id FROM products WHERE sku = $1 AND id != $2 LIMIT 1",
      [sku, input.id]
    );
    if (Array.isArray(dup) && dup.length > 0) {
      throw new Error("validation.skuDuplicate");
    }
  }

  await runInTransaction(async (db) => {
    await db.execute(
      `UPDATE products SET name = $1, sku = $2, barcode = $3, sale_price = $4, cost_price = $5, currency = $6,
        condition = $7, low_stock_threshold = $8, product_type = $9, category_id = $10, brand_id = $11,
        manufacturer_id = $12, model_number = $13, country_of_origin = $14, tracking_mode = $15,
        unit_of_measure = $16, warranty_months = $17, hs_code = $18, default_duty_rate = $19, description = $20,
        specs_json = $21, requires_license = $22, min_sale_qty = $23 WHERE id = $24`,
      [
        input.name,
        sku,
        barcode,
        input.sale_price,
        input.cost_price,
        input.currency,
        input.condition,
        input.low_stock_threshold,
        ...catalogValues(input),
        input.id,
      ]
    );
    await appendAuditLog(db, {
      action: "product.updated",
      actorUserId: operatorId,
      entity: "product",
      entityId: input.id,
      payload: JSON.stringify({ name: input.name }),
    });
  });
}

export async function softDeleteProductById(id: string): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const operatorId = await requireOperatorId();
  await runInTransaction(async (db) => {
    const hasRefs = await productHasReferences(db, id);
    if (hasRefs) {
      throw new Error("products.deleteBlocked");
    }
    await db.execute("UPDATE products SET is_active = 0 WHERE id = $1", [id]);
    await appendAuditLog(db, {
      action: "product.deleted",
      actorUserId: operatorId,
      entity: "product",
      entityId: id,
    });
  });
}

export async function getProductById(id: string): Promise<ProductRow | null> {
  if (!isTauri()) {
    return null;
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(`${PRODUCT_SELECT} WHERE id = $1`, [id]);
  const rows = z.array(productRowSchema).parse(raw);
  return rows[0] ?? null;
}

export interface ProductImportResult {
  imported: number;
  skippedDuplicates: number;
  skippedInvalid: number;
}

export async function importProductsBatch(
  items: ProductWriteInput[]
): Promise<ProductImportResult> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const operatorId = await requireOperatorId();
  const now = new Date().toISOString();
  let imported = 0;
  let skippedDuplicates = 0;
  let skippedInvalid = 0;

  await runInTransaction(async (db) => {
    for (const raw of items) {
      let input: ProductWriteInput;
      try {
        input = productWriteSchema.parse(raw);
      } catch {
        skippedInvalid += 1;
        continue;
      }

      const sku = normalizeSku(input.sku);
      if (sku) {
        const dup = await db.select<unknown>(
          "SELECT id FROM products WHERE sku = $1 LIMIT 1",
          [sku]
        );
        if (Array.isArray(dup) && dup.length > 0) {
          skippedDuplicates += 1;
          continue;
        }
      }

      const id = crypto.randomUUID();
      const barcode = normalizeBarcode(input.barcode);
      const openingQty = input.opening_qty ?? 0;

      await db.execute(
        `INSERT INTO products (id, name, sku, barcode, on_hand_qty, sale_price, cost_price, currency, condition, low_stock_threshold, is_active, created_at)
         VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, 1, $10)`,
        [
          id,
          input.name,
          sku,
          barcode,
          input.sale_price,
          input.cost_price,
          input.currency,
          input.condition,
          input.low_stock_threshold,
          now,
        ]
      );

      if (openingQty > 0) {
        const movId = crypto.randomUUID();
        await db.execute(
          `INSERT INTO stock_movements (id, product_id, type, quantity_delta, ref_id, operator_id, created_at)
           VALUES ($1, $2, 'opening', $3, $4, $5, $6)`,
          [movId, id, openingQty, id, operatorId, now]
        );
        await adjustProductStock(db, id, openingQty);
      }

      await appendAuditLog(db, {
        action: "product.created",
        actorUserId: operatorId,
        entity: "product",
        entityId: id,
        payload: JSON.stringify({ name: input.name, source: "import" }),
      });
      imported += 1;
    }
  });

  return { imported, skippedDuplicates, skippedInvalid };
}
