import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isMudirDesktop } from "@/lib/runtime";

export async function pickAndCopyCompanyAsset(
  kind: "logo" | "stamp" | "signature"
): Promise<string | null> {
  if (!isMudirDesktop()) {
    return null;
  }
  const selected = await open({
    filters: [{ extensions: ["png", "jpg", "jpeg", "webp"], name: "Image" }],
    multiple: false,
  });
  if (!selected || Array.isArray(selected)) {
    return null;
  }
  const ext = selected.split(".").pop() ?? "png";
  const fileName = `${kind}-${Date.now()}.${ext}`;
  return invoke<string>("copy_company_asset", {
    fileName,
    sourcePath: selected,
  });
}
