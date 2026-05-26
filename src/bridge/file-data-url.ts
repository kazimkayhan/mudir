import { invoke } from "@tauri-apps/api/core";
import { isMudirDesktop } from "@/lib/runtime";

export async function readFileAsDataUrl(
  path?: string | null
): Promise<string | null> {
  if (!(path && isMudirDesktop())) {
    return null;
  }
  try {
    return await invoke<string>("read_file_base64", { path });
  } catch {
    return null;
  }
}
