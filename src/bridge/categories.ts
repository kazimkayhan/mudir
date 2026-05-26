import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { loadAppDatabase, selectFirstRow } from "@/lib/app-db";

const categoryRowSchema = z.object({
  created_at: z.string(),
  id: z.string(),
  name_en: z.string(),
  name_fa: z.string(),
  parent_id: z.string().nullable(),
  sort_order: z.coerce.number(),
});

export type CategoryRow = z.infer<typeof categoryRowSchema>;

const SEED_CATEGORIES: Omit<CategoryRow, "created_at">[] = [
  {
    id: "cat-machines",
    name_en: "Machines",
    name_fa: "دستگاه‌ها",
    parent_id: null,
    sort_order: 1,
  },
  {
    id: "cat-laser",
    name_en: "Laser systems",
    name_fa: "سیستم‌های لیزر",
    parent_id: "cat-machines",
    sort_order: 1,
  },
  {
    id: "cat-consumables",
    name_en: "Consumables",
    name_fa: "مصرفی",
    parent_id: null,
    sort_order: 2,
  },
  {
    id: "cat-fillers",
    name_en: "Dermal fillers",
    name_fa: "فیلرهای پوستی",
    parent_id: "cat-consumables",
    sort_order: 1,
  },
  {
    id: "cat-surgical",
    name_en: "Surgical",
    name_fa: "جراحی",
    parent_id: null,
    sort_order: 3,
  },
  {
    id: "cat-clinic",
    name_en: "Clinic ops",
    name_fa: "عملیات کلینیک",
    parent_id: null,
    sort_order: 4,
  },
];

export async function ensureSeedCategories(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  const db = await loadAppDatabase();
  const count = await selectFirstRow<{ c: number }>(
    db,
    "SELECT COUNT(*) AS c FROM product_categories"
  );
  if ((count?.c ?? 0) > 0) {
    return;
  }
  const now = new Date().toISOString();
  for (const cat of SEED_CATEGORIES) {
    await db.execute(
      "INSERT OR IGNORE INTO product_categories (id, name_fa, name_en, parent_id, sort_order, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [cat.id, cat.name_fa, cat.name_en, cat.parent_id, cat.sort_order, now]
    );
  }
}

export async function listCategories(): Promise<CategoryRow[]> {
  if (!isTauri()) {
    return [];
  }
  await ensureSeedCategories();
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, name_fa, name_en, parent_id, sort_order, created_at FROM product_categories ORDER BY sort_order, name_en"
  );
  return z.array(categoryRowSchema).parse(raw);
}

export async function insertCategory(input: {
  nameEn: string;
  nameFa: string;
  parentId?: string;
}): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = await loadAppDatabase();
  await db.execute(
    "INSERT INTO product_categories (id, name_fa, name_en, parent_id, sort_order, created_at) VALUES ($1, $2, $3, $4, 0, $5)",
    [id, input.nameFa.trim(), input.nameEn.trim(), input.parentId ?? null, now]
  );
  return { id };
}
