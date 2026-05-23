"use client";

import { useEffect, useId, useState } from "react";
import { saveBusinessSettings } from "@/bridge/settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TranslationKey } from "@/i18n";
import { useI18n } from "@/i18n/hooks";

interface OnboardingWizardProps {
  onComplete: (storeName: string) => void;
  open: boolean;
}

function translateError(
  t: (key: TranslationKey) => string,
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

export function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
  const { t, locale, setLocale } = useI18n();
  const storeId = useId();
  const rateId = useId();
  const [storeName, setStoreName] = useState("");
  const [rate, setRate] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<"fa-AF" | "en">(locale);

  useEffect(() => {
    setSelectedLocale(locale);
  }, [locale]);

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      setLocale(selectedLocale);
      await saveBusinessSettings({
        defaultLocale: selectedLocale,
        onboardingCompleted: true,
        storeName: storeName.trim(),
        usdToAfnRate: rate,
      });
      onComplete(storeName.trim());
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(translateError(t, message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("onboarding.title")}</DialogTitle>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <FieldGroup>
          <Field>
            <Label htmlFor={storeId}>{t("onboarding.storeName")}</Label>
            <Input
              dir="auto"
              id={storeId}
              onChange={(e) => {
                setStoreName(e.target.value);
              }}
              value={storeName}
            />
          </Field>
          <Field>
            <Label>{t("onboarding.locale")}</Label>
            <Select
              onValueChange={(v) => {
                setSelectedLocale(v as "fa-AF" | "en");
              }}
              value={selectedLocale}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fa-AF">{t("shell.dari")} (fa-AF)</SelectItem>
                <SelectItem value="en">{t("shell.english")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Label htmlFor={rateId}>{t("onboarding.exchangeRate")}</Label>
            <NumberInput id={rateId} onValueChange={setRate} value={rate} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={busy || storeName.trim().length === 0}
            onClick={() => {
              finish().catch(() => undefined);
            }}
            type="button"
          >
            {t("onboarding.complete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
