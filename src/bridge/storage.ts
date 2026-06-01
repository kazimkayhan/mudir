import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { isMudirDesktop } from "@/lib/runtime";

const storagePathsSchema = z.object({
  backupsDir: z.string(),
  databasePath: z.string(),
  databaseUri: z.string(),
  dataRoot: z.string(),
  legacyDatabasePath: z.string().nullable().optional(),
});

export type StoragePaths = z.infer<typeof storagePathsSchema>;

export async function getStoragePaths(): Promise<StoragePaths | null> {
  if (!isMudirDesktop()) {
    return null;
  }
  const raw = await invoke<unknown>("get_storage_paths");
  return storagePathsSchema.parse(raw);
}
