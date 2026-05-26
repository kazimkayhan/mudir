"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLicenseStatus } from "@/bridge/license";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { LicenseStatus } from "@/domain/license/schemas";
import { useTranslations } from "@/i18n/hooks";

export function LicenseExpiryBanner() {
  const t = useTranslations();
  const [status, setStatus] = useState<LicenseStatus | null>(null);

  useEffect(() => {
    getLicenseStatus()
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  if (!status?.valid || status.expired) {
    return (
      <Alert className="mx-4 mt-2" variant="destructive">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          <span>{t("license.expiredBanner")}</span>
          <Button asChild size="sm" type="button" variant="outline">
            <Link href="/activate">{t("license.renew")}</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const days = status.daysRemaining ?? 999;
  if (days > 7) {
    return null;
  }

  return (
    <Alert className="mx-4 mt-2">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>
          {t("license.expiringSoon", {
            date: status.expiresAt ?? "",
            days: String(days),
          })}
        </span>
        <Button asChild size="sm" type="button" variant="outline">
          <Link href="/settings#subscription">{t("license.manage")}</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
