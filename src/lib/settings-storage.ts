import type { BusinessSettings } from "@/bridge/settings";

const STORAGE_KEY = "mudir-business-settings";

export function readStoredBusinessSettings(): BusinessSettings | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as BusinessSettings;
  } catch {
    return null;
  }
}

export function writeStoredBusinessSettings(settings: BusinessSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
