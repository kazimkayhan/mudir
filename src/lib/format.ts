export type AppLocale = "fa-AF" | "en";
export type CurrencyCode = "AFN" | "USD";

const CURRENCY_LABELS: Record<AppLocale, Record<CurrencyCode, string>> = {
  en: { AFN: "AFN", USD: "USD" },
  "fa-AF": { AFN: "افغانی", USD: "دالر" },
};

export function roundMoney(amount: number): number {
  const sign = amount < 0 ? -1 : 1;
  const scaled = Math.abs(amount) * 100 + 1e-8;
  return (sign * Math.round(scaled)) / 100;
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  locale: AppLocale
): string {
  const value = roundMoney(amount);
  if (currency === "USD") {
    if (locale === "fa-AF") {
      return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
    }
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  }
  const formatted = value.toLocaleString(
    locale === "fa-AF" ? "fa-AF" : "en-US",
    { maximumFractionDigits: 2, minimumFractionDigits: 2 }
  );
  if (locale === "fa-AF") {
    return `${formatted} ${CURRENCY_LABELS["fa-AF"].AFN}`;
  }
  return `${formatted} ${CURRENCY_LABELS.en.AFN}`;
}

export function formatDate(iso: string, locale: AppLocale): string {
  return new Date(iso).toLocaleString(locale === "fa-AF" ? "fa-AF" : "en-US");
}

export function formatNumber(value: number, locale: AppLocale): string {
  return value.toLocaleString(locale === "fa-AF" ? "fa-AF" : "en-US");
}

export function convertToAfn(
  amount: number,
  currency: CurrencyCode,
  exchangeRate: number
): number {
  if (currency === "AFN") {
    return roundMoney(amount);
  }
  return roundMoney(amount * exchangeRate);
}
