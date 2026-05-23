import type { TranslationKey } from "@/i18n";

export function translateError(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  message: string
): string {
  if (message.includes(".")) {
    const translated = t(message as TranslationKey);
    if (translated !== message) {
      return translated;
    }
  }
  return message;
}
