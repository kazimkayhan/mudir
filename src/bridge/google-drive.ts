import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { isMudirDesktop } from "@/lib/runtime";

const googleDriveStatusSchema = z.object({
  autoUpload: z.boolean(),
  clientId: z.string().nullable().optional(),
  connected: z.boolean(),
});

export type GoogleDriveStatus = z.infer<typeof googleDriveStatusSchema>;

export async function getGoogleDriveStatus(): Promise<GoogleDriveStatus> {
  if (!isMudirDesktop()) {
    return { autoUpload: false, connected: false };
  }
  const raw = await invoke<unknown>("get_google_drive_status");
  return googleDriveStatusSchema.parse(raw);
}

export async function connectGoogleDrive(clientId: string): Promise<void> {
  await invoke("connect_google_drive", { clientId });
}

export async function disconnectGoogleDrive(): Promise<void> {
  await invoke("disconnect_google_drive");
}

export async function setGoogleDriveAutoUpload(
  enabled: boolean
): Promise<void> {
  await invoke("set_google_drive_auto_upload", { enabled });
}

export async function uploadBackupToGoogleDrive(
  filePath: string
): Promise<void> {
  await invoke("upload_backup_to_google_drive", { filePath });
}
