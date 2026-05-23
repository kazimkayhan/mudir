import { z } from "zod";
import { loadAppDatabase } from "@/lib/app-db";
import { isMudirDesktop } from "@/lib/runtime";
import {
  readStoredBusinessSettings,
  writeStoredBusinessSettings,
} from "@/lib/settings-storage";

const settingsRowSchema = z.object({
  address: z.string().nullable(),
  base_currency: z.string(),
  default_locale: z.string(),
  id: z.string(),
  onboarding_completed: z.coerce.number(),
  phone: z.string().nullable(),
  store_name: z.string(),
  updated_at: z.string(),
  usd_to_afn_rate: z.coerce.number(),
});

export interface BusinessSettings {
  address?: string;
  baseCurrency: "AFN" | "USD";
  defaultLocale: "fa-AF" | "en";
  id: string;
  onboardingCompleted: boolean;
  phone?: string;
  storeName: string;
  updatedAt: string;
  usdToAfnRate: number;
}

function rowToSettings(
  row: z.infer<typeof settingsRowSchema>
): BusinessSettings {
  return {
    address: row.address ?? undefined,
    baseCurrency: row.base_currency === "USD" ? "USD" : "AFN",
    defaultLocale: row.default_locale === "en" ? "en" : "fa-AF",
    id: row.id,
    onboardingCompleted: row.onboarding_completed === 1,
    phone: row.phone ?? undefined,
    storeName: row.store_name,
    updatedAt: row.updated_at,
    usdToAfnRate: row.usd_to_afn_rate,
  };
}

const DEFAULT_SETTINGS: BusinessSettings = {
  baseCurrency: "AFN",
  defaultLocale: "fa-AF",
  id: "default",
  onboardingCompleted: false,
  storeName: "",
  updatedAt: new Date().toISOString(),
  usdToAfnRate: 70,
};

export async function getBusinessSettings(): Promise<BusinessSettings> {
  if (!isMudirDesktop()) {
    return readStoredBusinessSettings() ?? DEFAULT_SETTINGS;
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, store_name, address, phone, default_locale, base_currency, usd_to_afn_rate, onboarding_completed, updated_at FROM business_settings WHERE id = 'default'"
  );
  const rows = z.array(settingsRowSchema).parse(raw);
  return rows[0] ? rowToSettings(rows[0]) : DEFAULT_SETTINGS;
}

export async function saveBusinessSettings(
  input: Partial<
    Pick<
      BusinessSettings,
      | "storeName"
      | "address"
      | "phone"
      | "defaultLocale"
      | "baseCurrency"
      | "usdToAfnRate"
      | "onboardingCompleted"
    >
  >
): Promise<void> {
  const current = await getBusinessSettings();
  const now = new Date().toISOString();
  const next: BusinessSettings = {
    address: input.address ?? current.address,
    baseCurrency: input.baseCurrency ?? current.baseCurrency,
    defaultLocale: input.defaultLocale ?? current.defaultLocale,
    id: "default",
    onboardingCompleted:
      input.onboardingCompleted ?? current.onboardingCompleted,
    phone: input.phone ?? current.phone,
    storeName: input.storeName ?? current.storeName,
    updatedAt: now,
    usdToAfnRate: input.usdToAfnRate ?? current.usdToAfnRate,
  };

  if (!isMudirDesktop()) {
    writeStoredBusinessSettings(next);
    return;
  }

  const db = await loadAppDatabase();
  const existing = await db.select<unknown>(
    "SELECT id FROM business_settings WHERE id = 'default'"
  );
  if (Array.isArray(existing) && existing.length > 0) {
    await db.execute(
      `UPDATE business_settings SET store_name = $1, address = $2, phone = $3, default_locale = $4, base_currency = $5, usd_to_afn_rate = $6, onboarding_completed = $7, updated_at = $8 WHERE id = 'default'`,
      [
        next.storeName,
        next.address ?? null,
        next.phone ?? null,
        next.defaultLocale,
        next.baseCurrency,
        next.usdToAfnRate,
        next.onboardingCompleted ? 1 : 0,
        now,
      ]
    );
  } else {
    await db.execute(
      `INSERT INTO business_settings (id, store_name, address, phone, default_locale, base_currency, usd_to_afn_rate, onboarding_completed, updated_at) VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        next.storeName,
        next.address ?? null,
        next.phone ?? null,
        next.defaultLocale,
        next.baseCurrency,
        next.usdToAfnRate,
        next.onboardingCompleted ? 1 : 0,
        now,
      ]
    );
  }
}

export async function getSchemaVersion(): Promise<number> {
  if (!isMudirDesktop()) {
    return 0;
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT value FROM schema_meta WHERE key = 'version'"
  );
  const rows = z.array(z.object({ value: z.string() })).parse(raw);
  const v = rows[0]?.value;
  return v ? Number.parseInt(v, 10) : 8;
}
