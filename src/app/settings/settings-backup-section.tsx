"use client";

import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { DatabaseBackup, FolderOpen, Upload } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { CustomerImportDialog } from "@/app/customers/customer-import-dialog";
import { ProductImportDialog } from "@/app/products/product-import-dialog";
import {
  type BackupStatus,
  createBackupBundle,
  getBackupStatus,
  openBackupFolder,
  restoreBackupBundle,
  setAutoDailyBackup,
  todayBackupFileName,
} from "@/bridge/backup";
import {
  exportCustomersCsv,
  exportProductsCsv,
  exportSuppliersCsv,
} from "@/bridge/data-export";
import type { BusinessSettings } from "@/bridge/settings";
import { getStoragePaths, type StoragePaths } from "@/bridge/storage";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/hooks";
import {
  toastSuccess,
  toastTranslatedError,
  toastWarning,
} from "@/lib/app-toast";
import { isMudirDesktop } from "@/lib/runtime";

interface SettingsBackupSectionProps {
  busy: boolean;
  onError: (message: string) => void;
  profile: BusinessSettings | null;
  setBusy: (busy: boolean) => void;
}

export function SettingsBackupSection({
  busy,
  onError,
  profile,
  setBusy,
}: SettingsBackupSectionProps) {
  const { t } = useI18n();
  const backupSectionId = useId();
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [storagePaths, setStoragePaths] = useState<StoragePaths | null>(null);
  const [productImportOpen, setProductImportOpen] = useState(false);
  const [customerImportOpen, setCustomerImportOpen] = useState(false);

  const loadBackupStatus = useCallback(async () => {
    if (!isMudirDesktop()) {
      return;
    }
    try {
      const [status, paths] = await Promise.all([
        getBackupStatus(),
        getStoragePaths(),
      ]);
      setBackupStatus(status);
      setStoragePaths(paths);
    } catch {
      setBackupStatus(null);
      setStoragePaths(null);
    }
  }, []);

  useEffect(() => {
    loadBackupStatus().catch(() => undefined);
  }, [loadBackupStatus]);

  const runBackup = async () => {
    if (!(isMudirDesktop() && profile)) {
      return;
    }
    setBusy(true);
    onError("");
    try {
      const destPath = await save({
        defaultPath: todayBackupFileName(),
        filters: [{ extensions: ["mudir-backup"], name: "Mudir backup" }],
        title: t("data.backup.now"),
      });
      if (!destPath) {
        return;
      }
      await createBackupBundle(
        destPath,
        profile.tradeName ?? profile.storeName
      );
      toastSuccess(t("data.backup.success"));
      await loadBackupStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      onError(msg);
      toastTranslatedError(t, e);
    } finally {
      setBusy(false);
    }
  };

  const runRestore = async () => {
    if (!isMudirDesktop()) {
      return;
    }
    const ok = await ask(t("data.restore.confirm"), {
      kind: "warning",
      title: t("settings.restore"),
    });
    if (!ok) {
      return;
    }
    setBusy(true);
    onError("");
    try {
      const selected = await open({
        filters: [{ extensions: ["mudir-backup", "db"], name: "Mudir backup" }],
        multiple: false,
        title: t("settings.restore"),
      });
      if (selected === null || Array.isArray(selected)) {
        return;
      }
      if (selected.endsWith(".db")) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("restore_mudir_database", { srcPath: selected });
      } else {
        await restoreBackupBundle(selected);
      }
      toastWarning(t("data.restore.done"));
      await loadBackupStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      onError(msg);
      toastTranslatedError(t, e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="mt-8" id="backup">
        <CardHeader>
          <CardTitle id={backupSectionId}>{t("data.title")}</CardTitle>
          <CardDescription>{t("data.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {storagePaths ? (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <p className="font-medium text-sm">{t("data.storage.title")}</p>
              <dl className="space-y-1 text-muted-foreground text-sm">
                <div>
                  <dt className="inline font-medium text-foreground">
                    {t("data.storage.dataRoot")}:{" "}
                  </dt>
                  <dd className="inline break-all font-mono text-xs">
                    {storagePaths.dataRoot}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium text-foreground">
                    {t("data.storage.databasePath")}:{" "}
                  </dt>
                  <dd className="inline break-all font-mono text-xs">
                    {storagePaths.databasePath}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium text-foreground">
                    {t("data.storage.databaseUri")}:{" "}
                  </dt>
                  <dd className="inline break-all font-mono text-xs">
                    {storagePaths.databaseUri}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium text-foreground">
                    {t("data.storage.backupsDir")}:{" "}
                  </dt>
                  <dd className="inline break-all font-mono text-xs">
                    {storagePaths.backupsDir}
                  </dd>
                </div>
                {storagePaths.legacyDatabasePath ? (
                  <div>
                    <dt className="inline font-medium text-foreground">
                      {t("data.storage.legacyPath")}:{" "}
                    </dt>
                    <dd className="inline break-all font-mono text-xs">
                      {storagePaths.legacyDatabasePath}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="font-medium text-sm">{t("data.backup.autoTitle")}</p>
            <p className="text-muted-foreground text-sm">
              {t("data.backup.autoDesc")}
            </p>
            {backupStatus ? (
              <p className="text-muted-foreground text-sm">
                {t("data.backup.folder")}: {backupStatus.dir}
              </p>
            ) : null}
            {backupStatus?.lastBackupAt ? (
              <p className="text-muted-foreground text-sm">
                {t("data.backup.last", { when: backupStatus.lastBackupAt })}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("data.backup.none")}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={backupStatus?.autoEnabled ?? true}
                disabled={!isMudirDesktop() || busy}
                onCheckedChange={(enabled) => {
                  setAutoDailyBackup(enabled)
                    .then(() => loadBackupStatus())
                    .catch(() => undefined);
                }}
              />
              <span className="text-sm">{t("data.backup.autoEnabled")}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                data-icon="inline-start"
                disabled={busy || !isMudirDesktop()}
                onClick={() => {
                  openBackupFolder().catch(() => undefined);
                }}
                type="button"
                variant="outline"
              >
                <FolderOpen aria-hidden />
                {t("data.backup.openFolder")}
              </Button>
              <Button
                data-icon="inline-start"
                disabled={busy || !isMudirDesktop()}
                onClick={() => {
                  runBackup().catch(() => undefined);
                }}
                type="button"
              >
                <DatabaseBackup aria-hidden />
                {t("data.backup.now")}
              </Button>
              <Button
                data-icon="inline-start"
                disabled={busy || !isMudirDesktop()}
                onClick={() => {
                  runRestore().catch(() => undefined);
                }}
                type="button"
                variant="destructive"
              >
                <Upload aria-hidden />
                {t("settings.restore")}…
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-sm">{t("data.export.title")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => {
                  exportProductsCsv()
                    .then(() => toastSuccess(t("common.toast.exported")))
                    .catch((e: unknown) => toastTranslatedError(t, e));
                }}
                type="button"
                variant="outline"
              >
                {t("data.export.products")}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  exportCustomersCsv()
                    .then(() => toastSuccess(t("common.toast.exported")))
                    .catch((e: unknown) => toastTranslatedError(t, e));
                }}
                type="button"
                variant="outline"
              >
                {t("data.export.customers")}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  exportSuppliersCsv()
                    .then(() => toastSuccess(t("common.toast.exported")))
                    .catch((e: unknown) => toastTranslatedError(t, e));
                }}
                type="button"
                variant="outline"
              >
                {t("data.export.suppliers")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-sm">{t("data.import.title")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => setProductImportOpen(true)}
                type="button"
                variant="outline"
              >
                {t("data.import.products")}
              </Button>
              <Button
                disabled={busy}
                onClick={() => setCustomerImportOpen(true)}
                type="button"
                variant="outline"
              >
                {t("data.import.customers")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ProductImportDialog
        onClose={() => setProductImportOpen(false)}
        onImported={() => undefined}
        open={productImportOpen}
      />
      <CustomerImportDialog
        onClose={() => setCustomerImportOpen(false)}
        onImported={() => undefined}
        open={customerImportOpen}
      />
    </>
  );
}
