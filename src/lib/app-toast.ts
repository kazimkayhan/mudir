import { toast } from "sonner";
import type { TranslationKey } from "@/i18n";
import { translateError } from "@/lib/translate-error";

const SUCCESS_DURATION_MS = 4000;
const ERROR_DURATION_MS = 6000;

export function toastSuccess(message: string): void {
  toast.success(message, { duration: SUCCESS_DURATION_MS });
}

export function toastError(message: string): void {
  toast.error(message, { duration: ERROR_DURATION_MS });
}

export function toastWarning(message: string): void {
  toast.warning(message, { duration: ERROR_DURATION_MS });
}

export function toastInfo(message: string): void {
  toast.info(message, { duration: SUCCESS_DURATION_MS });
}

export function toastTranslatedError(
  t: (key: TranslationKey) => string,
  error: unknown
): void {
  const message = error instanceof Error ? error.message : String(error);
  toastError(translateError(t, message));
}
