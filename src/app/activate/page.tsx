"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { activateLicense } from "@/bridge/license";
import { AppLogo } from "@/components/app-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEV_LICENSE_KEY } from "@/domain/license/schemas";
import { useI18n } from "@/i18n/hooks";
import { isMudirDesktop } from "@/lib/runtime";
import { translateError } from "@/lib/translate-error";

export default function ActivatePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const trimmed = key.trim();
      if (!trimmed) {
        setError(t("license.keyRequired"));
        return;
      }
      const status = await activateLicense(trimmed);
      if (!status.valid) {
        setError(t("license.expired"));
        return;
      }
      router.replace("/welcome");
    } catch (e: unknown) {
      setError(translateError(t, e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-linear-to-br from-background via-background to-primary/5 px-6 py-10">
      <div className="w-full max-w-lg rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <AppLogo size={40} />
          <div>
            <h1 className="font-semibold text-2xl">
              {t("license.activateTitle")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("license.activateDesc")}
            </p>
          </div>
        </div>

        {error ? (
          <Alert className="mb-4" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup>
          <Field>
            <Label htmlFor="license-key">{t("license.keyLabel")}</Label>
            <Textarea
              id="license-key"
              onChange={(e) => setKey(e.target.value)}
              placeholder={t("license.keyPlaceholder")}
              rows={4}
              value={key}
            />
          </Field>
        </FieldGroup>

        {process.env.NODE_ENV === "development" && isMudirDesktop() ? (
          <p className="mt-3 text-muted-foreground text-xs">
            {t("license.devHint", { key: DEV_LICENSE_KEY })}
          </p>
        ) : null}

        <Button
          className="mt-6 w-full"
          disabled={busy}
          onClick={() => {
            submit().catch(() => undefined);
          }}
          type="button"
        >
          {t("license.activate")}
        </Button>
      </div>
    </div>
  );
}
