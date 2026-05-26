import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { loadAppDatabase } from "@/lib/app-db";

const brandRowSchema = z.object({
  country: z.string().nullable(),
  created_at: z.string(),
  id: z.string(),
  name: z.string(),
  website: z.string().nullable(),
});

export type BrandRow = z.infer<typeof brandRowSchema>;

export async function listBrands(): Promise<BrandRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, name, country, website, created_at FROM brands ORDER BY name"
  );
  return z.array(brandRowSchema).parse(raw);
}

export async function insertBrand(input: {
  country?: string;
  name: string;
  website?: string;
}): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = await loadAppDatabase();
  await db.execute(
    "INSERT INTO brands (id, name, country, website, created_at) VALUES ($1, $2, $3, $4, $5)",
    [id, input.name.trim(), input.country ?? null, input.website ?? null, now]
  );
  return { id };
}
