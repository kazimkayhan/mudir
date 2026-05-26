"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { activateLicense, getLicenseStatus } from "@/bridge/license";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LicenseStatus } from "@/domain/license/schemas";
import { useTranslations } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
import { translateError } from "@/lib/translate-error";

export function SettingsSubscriptionSection() {
  const t = useTranslations();
  const keyId = useId();
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus(await getLicenseStatus());
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const submit = async () => {
    setError(null);
    try {
      const next = await activateLicense(key.trim());
      setStatus(next);
      setKey("");
      toastSuccess(t("license.updated"));
    } catch (e: unknown) {
      toastTranslatedError(t, e);
      setError(translateError(t, e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="space-y-3">
      {status?.email ? (
        <p className="text-sm">
          <span className="text-muted-foreground">
            {t("license.licensedTo")}:{" "}
          </span>
          {status.email}
        </p>
      ) : null}
      {status?.expiresAt ? (
        <p className="text-sm">
          <span className="text-muted-foreground">
            {t("license.expires")}:{" "}
          </span>
          {status.expiresAt}
          {status.daysRemaining !== null &&
          status.daysRemaining !== undefined ? (
            <span className="text-muted-foreground">
              {" "}
              (
              {t("license.daysRemaining", {
                days: String(status.daysRemaining),
              })}
              )
            </span>
          ) : null}
        </p>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <Field>
          <Label htmlFor={keyId}>{t("license.renewKey")}</Label>
          <Textarea
            id={keyId}
            onChange={(e) => setKey(e.target.value)}
            rows={3}
            value={key}
          />
        </Field>
      </FieldGroup>
      <Button
        disabled={!key.trim()}
        onClick={() => {
          submit().catch(() => undefined);
        }}
        type="button"
      >
        {t("license.activate")}
      </Button>
    </div>
  );
}
