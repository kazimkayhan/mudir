import { invoke } from "@tauri-apps/api/core";
import {
  type LicenseStatus,
  licenseStatusSchema,
} from "@/domain/license/schemas";
import { isMudirDesktop } from "@/lib/runtime";

const browserDevStatus: LicenseStatus = {
  daysRemaining: 9999,
  email: "dev@local",
  expired: false,
  expiresAt: "2099-12-31",
  plan: "dev",
  valid: true,
};

export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (!isMudirDesktop()) {
    return browserDevStatus;
  }
  const raw = await invoke<unknown>("get_license_status");
  return licenseStatusSchema.parse(raw);
}

export async function activateLicense(key: string): Promise<LicenseStatus> {
  if (!isMudirDesktop()) {
    return browserDevStatus;
  }
  const raw = await invoke<unknown>("activate_license", { key });
  return licenseStatusSchema.parse(raw);
}

export async function clearLicense(): Promise<void> {
  if (!isMudirDesktop()) {
    return;
  }
  await invoke("clear_license");
}

export function isLicenseUsable(status: LicenseStatus): boolean {
  return status.valid && !status.expired;
}
