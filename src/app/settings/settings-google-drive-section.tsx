"use client";

import { Cloud, CloudOff } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { getBackupStatus } from "@/bridge/backup";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  type GoogleDriveStatus,
  getGoogleDriveStatus,
  setGoogleDriveAutoUpload,
  uploadBackupToGoogleDrive,
} from "@/bridge/google-drive";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
import { isMudirDesktop } from "@/lib/runtime";

export function SettingsGoogleDriveSection() {
  const { t } = useI18n();
  const clientIdField = useId();
  const [status, setStatus] = useState<GoogleDriveStatus | null>(null);
  const [lastBackupPath, setLastBackupPath] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isMudirDesktop()) {
      return;
    }
    const [driveStatus, backupStatus] = await Promise.all([
      getGoogleDriveStatus(),
      getBackupStatus(),
    ]);
    setStatus(driveStatus);
    setLastBackupPath(backupStatus?.lastBackupPath ?? null);
    if (driveStatus.clientId) {
      setClientId(driveStatus.clientId);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  if (!isMudirDesktop()) {
    return null;
  }

  return (
    <Card className="mt-8" id="google-drive">
      <CardHeader>
        <CardTitle>{t("data.googleDrive.title")}</CardTitle>
        <CardDescription>{t("data.googleDrive.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {status?.connected ? (
          <>
            <p className="text-muted-foreground text-sm">
              {t("data.googleDrive.connected")}
            </p>
            <div className="flex items-center gap-2">
              <Switch
                checked={status.autoUpload}
                disabled={busy}
                onCheckedChange={(enabled) => {
                  setBusy(true);
                  setGoogleDriveAutoUpload(enabled)
                    .then(() => refresh())
                    .catch((e: unknown) => toastTranslatedError(t, e))
                    .finally(() => setBusy(false));
                }}
              />
              <span className="text-sm">
                {t("data.googleDrive.autoUpload")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || !lastBackupPath}
                onClick={() => {
                  if (!lastBackupPath) {
                    return;
                  }
                  setBusy(true);
                  uploadBackupToGoogleDrive(lastBackupPath)
                    .then(() => {
                      setError(null);
                      toastSuccess(t("data.googleDrive.toast.uploaded"));
                    })
                    .catch((e: unknown) => toastTranslatedError(t, e))
                    .finally(() => setBusy(false));
                }}
                type="button"
                variant="outline"
              >
                <Cloud aria-hidden />
                {t("data.googleDrive.uploadNow")}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  disconnectGoogleDrive()
                    .then(() => {
                      refresh();
                      toastSuccess(t("data.googleDrive.toast.disconnected"));
                    })
                    .catch((e: unknown) => toastTranslatedError(t, e))
                    .finally(() => setBusy(false));
                }}
                type="button"
                variant="ghost"
              >
                <CloudOff aria-hidden />
                {t("data.googleDrive.disconnect")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field>
              <Label htmlFor={clientIdField}>
                {t("data.googleDrive.clientId")}
              </Label>
              <Input
                id={clientIdField}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="123456789.apps.googleusercontent.com"
                value={clientId}
              />
            </Field>
            <p className="text-muted-foreground text-xs">
              {t("data.googleDrive.clientIdHint")}
            </p>
            <Button
              disabled={busy || !clientId.trim()}
              onClick={() => {
                setBusy(true);
                setError(null);
                connectGoogleDrive(clientId.trim())
                  .then(() => {
                    refresh();
                    toastSuccess(t("data.googleDrive.toast.connected"));
                  })
                  .catch((e: unknown) => toastTranslatedError(t, e))
                  .finally(() => setBusy(false));
              }}
              type="button"
            >
              <Cloud aria-hidden />
              {t("data.googleDrive.connect")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
