import en from "@/i18n/en.json" with { type: "json" };
import faAF from "@/i18n/fa-AF.json" with { type: "json" };

export type AppLocale = "fa-AF" | "en";
export type TranslationKey = keyof typeof faAF;

const messages: Record<AppLocale, Record<string, string>> = {
  en,
  "fa-AF": faAF,
};

export function translate(
  locale: AppLocale,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  let text = messages[locale][key] ?? messages["fa-AF"][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export const LOCALE_STORAGE_KEY = "mudir-locale";

export function getStoredLocale(): AppLocale {
  if (typeof window === "undefined") {
    return "fa-AF";
  }
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === "en" ? "en" : "fa-AF";
}

export function setStoredLocale(locale: AppLocale): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export const navKeys: Record<string, TranslationKey> = {
  "/customers": "nav.customers",
  "/dashboard": "nav.dashboard",
  "/finance": "nav.finance",
  "/inventory": "nav.inventory",
  "/orders": "nav.orders",
  "/pos": "nav.pos",
  "/products": "nav.products",
  "/purchases": "nav.purchases",
  "/reports": "nav.reports",
  "/settings": "nav.settings",
};
