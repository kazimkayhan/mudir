import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { z } from "zod";
import { loadAppDatabase } from "@/lib/app-db";
import { runInTransaction } from "@/lib/run-in-transaction";
import { isMudirDesktop } from "@/lib/runtime";

const kitRowSchema = z.object({
  component_name: z.string().nullable(),
  component_product_id: z.string(),
  id: z.string(),
  quantity: z.coerce.number(),
});

const documentRowSchema = z.object({
  created_at: z.string(),
  doc_type: z.string(),
  file_path: z.string(),
  id: z.string(),
  title: z.string(),
});

const imageRowSchema = z.object({
  created_at: z.string(),
  file_path: z.string(),
  id: z.string(),
  sort_order: z.coerce.number(),
});

export type ProductKitRow = z.infer<typeof kitRowSchema>;
export type ProductDocumentRow = z.infer<typeof documentRowSchema>;
export type ProductImageRow = z.infer<typeof imageRowSchema>;

export async function listProductKitItems(
  kitProductId: string
): Promise<ProductKitRow[]> {
  if (!isMudirDesktop()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `SELECT k.id, k.component_product_id, p.name AS component_name, k.quantity
     FROM product_kit_items k
     LEFT JOIN products p ON p.id = k.component_product_id
     WHERE k.kit_product_id = $1`,
    [kitProductId]
  );
  return z.array(kitRowSchema).parse(raw);
}

export async function addProductKitItem(input: {
  componentProductId: string;
  kitProductId: string;
  quantity: number;
}): Promise<void> {
  if (!isMudirDesktop()) {
    throw new Error("common.db.tauriOnly");
  }
  await runInTransaction(async (db) => {
    await db.execute(
      "INSERT INTO product_kit_items (id, kit_product_id, component_product_id, quantity) VALUES ($1, $2, $3, $4)",
      [
        crypto.randomUUID(),
        input.kitProductId,
        input.componentProductId,
        input.quantity,
      ]
    );
  });
}

export async function removeProductKitItem(id: string): Promise<void> {
  if (!isMudirDesktop()) {
    throw new Error("common.db.tauriOnly");
  }
  await runInTransaction(async (db) => {
    await db.execute("DELETE FROM product_kit_items WHERE id = $1", [id]);
  });
}

export async function listProductDocuments(
  productId: string
): Promise<ProductDocumentRow[]> {
  if (!isMudirDesktop()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, doc_type, title, file_path, created_at FROM product_documents WHERE product_id = $1 ORDER BY created_at DESC",
    [productId]
  );
  return z.array(documentRowSchema).parse(raw);
}

export async function listProductImages(
  productId: string
): Promise<ProductImageRow[]> {
  if (!isMudirDesktop()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, file_path, sort_order, created_at FROM product_images WHERE product_id = $1 ORDER BY sort_order, created_at",
    [productId]
  );
  return z.array(imageRowSchema).parse(raw);
}

export async function pickAndCopyProductAsset(
  productId: string,
  kind: "image" | "document"
): Promise<string | null> {
  if (!isMudirDesktop()) {
    return null;
  }
  const selected = await open({
    filters: [
      {
        extensions: ["png", "jpg", "jpeg", "webp", "pdf"],
        name: "Product file",
      },
    ],
    multiple: false,
  });
  if (!selected || Array.isArray(selected)) {
    return null;
  }
  const ext = selected.split(".").pop() ?? "bin";
  const fileName = `${kind}-${Date.now()}.${ext}`;
  return invoke<string>("copy_product_asset", {
    fileName,
    productId,
    sourcePath: selected,
  });
}

export async function addProductDocument(input: {
  docType: string;
  filePath: string;
  productId: string;
  title: string;
}): Promise<void> {
  if (!isMudirDesktop()) {
    throw new Error("common.db.tauriOnly");
  }
  const now = new Date().toISOString();
  await runInTransaction(async (db) => {
    await db.execute(
      "INSERT INTO product_documents (id, product_id, doc_type, title, file_path, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        crypto.randomUUID(),
        input.productId,
        input.docType,
        input.title,
        input.filePath,
        now,
      ]
    );
  });
}

export async function addProductImage(input: {
  filePath: string;
  productId: string;
  sortOrder?: number;
}): Promise<void> {
  if (!isMudirDesktop()) {
    throw new Error("common.db.tauriOnly");
  }
  const now = new Date().toISOString();
  await runInTransaction(async (db) => {
    await db.execute(
      "INSERT INTO product_images (id, product_id, file_path, sort_order, created_at) VALUES ($1, $2, $3, $4, $5)",
      [
        crypto.randomUUID(),
        input.productId,
        input.filePath,
        input.sortOrder ?? 0,
        now,
      ]
    );
  });
}

export async function deleteProductDocument(id: string): Promise<void> {
  if (!isMudirDesktop()) {
    throw new Error("common.db.tauriOnly");
  }
  await runInTransaction(async (db) => {
    await db.execute("DELETE FROM product_documents WHERE id = $1", [id]);
  });
}

export async function deleteProductImage(id: string): Promise<void> {
  if (!isMudirDesktop()) {
    throw new Error("common.db.tauriOnly");
  }
  await runInTransaction(async (db) => {
    await db.execute("DELETE FROM product_images WHERE id = $1", [id]);
  });
}
