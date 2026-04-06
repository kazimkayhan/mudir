import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import {
  normalizeSku,
  productUpdateSchema,
  productWriteSchema,
} from "@/domain/products/schemas";
import { loadAppDatabase } from "@/lib/app-db";
import { DEFAULT_AUDIT_ACTOR_ID, logAuditEvent } from "@/lib/audit-log";

export const productRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  on_hand_qty: z.coerce.number(),
  created_at: z.string(),
});

export type ProductRow = z.infer<typeof productRowSchema>;

const countRowSchema = z.object({
  n: z.coerce.number(),
});

/** لیست محصولات از SQLite (tauri-plugin-sql) + اعتبارسنجی Zod. */
export async function listProducts(): Promise<ProductRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, name, sku, on_hand_qty, created_at FROM products ORDER BY name COLLATE NOCASE",
  );
  return z.array(productRowSchema).parse(raw);
}

/** اگر جدول خالی باشد، دو ردیف نمونه درج می‌کند. */
export async function seedDevProductsIfEmpty(): Promise<{ seeded: number }> {
  if (!isTauri()) {
    return { seeded: 0 };
  }
  const db = await loadAppDatabase();
  const countRaw = await db.select<unknown>(
    "SELECT COUNT(*) as n FROM products",
  );
  const parsed = z.array(countRowSchema).parse(countRaw);
  const n = parsed[0]?.n ?? 0;
  if (n > 0) {
    return { seeded: 0 };
  }
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO products (id, name, sku, on_hand_qty, created_at) VALUES ($1, $2, $3, $4, $5)",
    ["dev-seed-1", "Demo — Widget A", "SKU-DEMO-1", 100, now],
  );
  await db.execute(
    "INSERT INTO products (id, name, sku, on_hand_qty, created_at) VALUES ($1, $2, $3, $4, $5)",
    ["dev-seed-2", "Demo — Widget B", "SKU-DEMO-2", 50, now],
  );
  return { seeded: 2 };
}

/** درج محصول؛ `raw` با `productWriteSchema` اعتبارسنجی می‌شود. */
export async function insertProduct(raw: unknown): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("Database is only available inside the Tauri app.");
  }
  const input = productWriteSchema.parse(raw);
  const id = crypto.randomUUID();
  const sku = normalizeSku(input.sku);
  const now = new Date().toISOString();
  const db = await loadAppDatabase();
  await db.execute(
    "INSERT INTO products (id, name, sku, on_hand_qty, created_at) VALUES ($1, $2, $3, $4, $5)",
    [id, input.name, sku, input.on_hand_qty, now],
  );
  await logAuditEvent({
    actorUserId: DEFAULT_AUDIT_ACTOR_ID,
    action: "product.created",
    entity: "product",
    entityId: id,
    payload: JSON.stringify({ name: input.name }),
  });
  return { id };
}

/** به‌روزرسانی ردیف موجود. */
export async function updateProduct(raw: unknown): Promise<void> {
  if (!isTauri()) {
    throw new Error("Database is only available inside the Tauri app.");
  }
  const input = productUpdateSchema.parse(raw);
  const sku = normalizeSku(input.sku);
  const db = await loadAppDatabase();
  await db.execute(
    "UPDATE products SET name = $1, sku = $2, on_hand_qty = $3 WHERE id = $4",
    [input.name, sku, input.on_hand_qty, input.id],
  );
  await logAuditEvent({
    actorUserId: DEFAULT_AUDIT_ACTOR_ID,
    action: "product.updated",
    entity: "product",
    entityId: input.id,
    payload: JSON.stringify({ name: input.name }),
  });
}

export async function deleteProductById(id: string): Promise<void> {
  if (!isTauri()) {
    throw new Error("Database is only available inside the Tauri app.");
  }
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    throw new Error("Product id is required.");
  }
  const db = await loadAppDatabase();
  await db.execute("DELETE FROM products WHERE id = $1", [trimmed]);
  await logAuditEvent({
    actorUserId: DEFAULT_AUDIT_ACTOR_ID,
    action: "product.deleted",
    entity: "product",
    entityId: trimmed,
  });
}
