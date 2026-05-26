import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { isMudirDesktop } from "@/lib/runtime";

const backupStatusSchema = z.object({
  autoEnabled: z.boolean(),
  dir: z.string(),
  lastBackupAt: z.string().nullable().optional(),
  lastBackupPath: z.string().nullable().optional(),
  todayExists: z.boolean(),
});

export type BackupStatus = z.infer<typeof backupStatusSchema>;

export async function getBackupStatus(): Promise<BackupStatus | null> {
  if (!isMudirDesktop()) {
    return null;
  }
  const raw = await invoke<unknown>("get_backup_status");
  return backupStatusSchema.parse(raw);
}

export async function createBackupBundle(
  destPath: string,
  companyName: string
): Promise<void> {
  await invoke("create_mudir_backup_bundle", { companyName, destPath });
}

export async function restoreBackupBundle(srcPath: string): Promise<void> {
  await invoke("restore_mudir_backup_bundle", { srcPath });
}

export function runDailyBackupIfNeeded(
  companyName: string
): Promise<string | null> {
  if (!isMudirDesktop()) {
    return Promise.resolve(null);
  }
  return invoke<string | null>("run_daily_backup_if_needed", { companyName });
}

export async function setAutoDailyBackup(enabled: boolean): Promise<void> {
  if (!isMudirDesktop()) {
    return;
  }
  await invoke("set_auto_daily_backup", { enabled });
}

export async function openBackupFolder(): Promise<void> {
  if (!isMudirDesktop()) {
    return;
  }
  await invoke("open_backup_folder");
}

export function todayBackupFileName(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `mudir-backup-${date}.mudir-backup`;
}
