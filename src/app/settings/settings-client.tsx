"use client";

import { invoke } from "@tauri-apps/api/core";
import { ask, message, open, save } from "@tauri-apps/plugin-dialog";
import { DatabaseBackup, RefreshCw, Save, Upload } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { type AuditLogRow, listRecentAuditLogs } from "@/bridge/audit";
import {
  type BusinessSettings,
  getBusinessSettings,
  getSchemaVersion,
  saveBusinessSettings,
} from "@/bridge/settings";
import { PageTitle } from "@/components/app-icons";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n/hooks";
import { isMudirDesktop } from "@/lib/runtime";

export function SettingsClient() {
  const { t, setLocale } = useI18n();
  const backupSectionId = useId();
  const profileSectionId = useId();
  const auditSectionId = useId();
  const storeNameId = useId();
  const addressId = useId();
  const phoneId = useId();
  const rateId = useId();

  const [audit, setAudit] = useState<AuditLogRow[]>([]);
  const [profile, setProfile] = useState<BusinessSettings | null>(null);
  const [schemaVersion, setSchemaVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const refreshAudit = useCallback(async () => {
    setError(null);
    try {
      const rows = await listRecentAuditLogs(100);
      setAudit(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setError(null);
    try {
      const [settings, version] = await Promise.all([
        getBusinessSettings(),
        getSchemaVersion(),
      ]);
      setProfile(settings);
      setSchemaVersion(version);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refreshAudit().catch(() => undefined);
    loadProfile().catch(() => undefined);
  }, [refreshAudit, loadProfile]);

  const saveProfile = async () => {
    if (!profile) {
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await saveBusinessSettings({
        address: profile.address,
        baseCurrency: profile.baseCurrency,
        defaultLocale: profile.defaultLocale,
        phone: profile.phone,
        storeName: profile.storeName,
        usdToAfnRate: profile.usdToAfnRate,
      });
      setLocale(profile.defaultLocale);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runBackup = async () => {
    if (!isMudirDesktop()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const destPath = await save({
        defaultPath: "mudir-backup.db",
        filters: [{ extensions: ["db"], name: "SQLite" }],
        title: t("settings.backup"),
      });
      if (!destPath) {
        return;
      }
      await invoke("backup_mudir_database", { destPath });
      await message(t("common.success"), { title: "Mudir" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      await message(msg, { kind: "error", title: t("common.error") });
    } finally {
      setBusy(false);
    }
  };

  const runRestore = async () => {
    if (!isMudirDesktop()) {
      return;
    }
    const ok = await ask(t("settings.restoreConfirm"), {
      kind: "warning",
      title: t("settings.restore"),
    });
    if (!ok) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const selected = await open({
        filters: [{ extensions: ["db"], name: "SQLite" }],
        multiple: false,
        title: t("settings.restore"),
      });
      if (selected === null || Array.isArray(selected)) {
        return;
      }
      await invoke("restore_mudir_database", { srcPath: selected });
      const version = await getSchemaVersion();
      setSchemaVersion(version);
      await message(t("settings.restoreDone"), {
        kind: "warning",
        title: t("common.success"),
      });
      await refreshAudit();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      await message(msg, { kind: "error", title: t("common.error") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 pb-6">
      <PageHeader>
        <PageTitle href="/settings">{t("settings.title")}</PageTitle>
        <p className="mt-1 text-muted-foreground text-sm">
          {t("settings.profile")} · {t("settings.backup")} ·{" "}
          {schemaVersion === null ? null : `schema v${schemaVersion}`}
        </p>
      </PageHeader>

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {saved ? (
        <Alert className="mt-4">
          <AlertDescription>{t("common.success")}</AlertDescription>
        </Alert>
      ) : null}

      {isMudirDesktop() ? null : (
        <Alert className="mt-4">
          <AlertDescription>{t("settings.browserPreview")}</AlertDescription>
        </Alert>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle id={profileSectionId}>{t("settings.profile")}</CardTitle>
          <CardDescription>{t("shell.storeName")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile ? (
            <>
              <Field>
                <Label htmlFor={storeNameId}>{t("onboarding.storeName")}</Label>
                <Input
                  dir="auto"
                  id={storeNameId}
                  onChange={(e) =>
                    setProfile({ ...profile, storeName: e.target.value })
                  }
                  value={profile.storeName}
                />
              </Field>
              <Field>
                <Label htmlFor={addressId}>{t("settings.address")}</Label>
                <Input
                  dir="auto"
                  id={addressId}
                  onChange={(e) =>
                    setProfile({ ...profile, address: e.target.value })
                  }
                  value={profile.address ?? ""}
                />
              </Field>
              <Field>
                <Label htmlFor={phoneId}>{t("settings.phone")}</Label>
                <Input
                  dir="auto"
                  id={phoneId}
                  onChange={(e) =>
                    setProfile({ ...profile, phone: e.target.value })
                  }
                  value={profile.phone ?? ""}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <Label>{t("onboarding.locale")}</Label>
                  <Select
                    onValueChange={(v) =>
                      setProfile({
                        ...profile,
                        defaultLocale: v === "en" ? "en" : "fa-AF",
                      })
                    }
                    value={profile.defaultLocale}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fa-AF">دری (fa-AF)</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <Label>{t("common.currency.afn")} / USD</Label>
                  <Select
                    onValueChange={(v) =>
                      setProfile({
                        ...profile,
                        baseCurrency: v === "USD" ? "USD" : "AFN",
                      })
                    }
                    value={profile.baseCurrency}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AFN">
                        {t("common.currency.afn")}
                      </SelectItem>
                      <SelectItem value="USD">
                        {t("common.currency.usd")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <Label htmlFor={rateId}>{t("onboarding.exchangeRate")}</Label>
                <NumberInput
                  id={rateId}
                  onValueChange={(usdToAfnRate) =>
                    setProfile({
                      ...profile,
                      usdToAfnRate,
                    })
                  }
                  step={0.01}
                  value={profile.usdToAfnRate}
                />
              </Field>
              <Button
                data-icon="inline-start"
                disabled={busy}
                onClick={() => {
                  saveProfile().catch(() => undefined);
                }}
                type="button"
              >
                <Save aria-hidden />
                {t("common.save")}
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("common.loading")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle id={backupSectionId}>
            {t("settings.backup")} / {t("settings.restore")}
          </CardTitle>
          <CardDescription>{t("settings.backupDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            data-icon="inline-start"
            disabled={busy || !isMudirDesktop()}
            onClick={() => {
              runBackup().catch(() => undefined);
            }}
            type="button"
          >
            <DatabaseBackup aria-hidden />
            {t("settings.backup")}…
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
        </CardContent>
      </Card>

      <Card className="mt-10">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle id={auditSectionId}>{t("settings.auditLog")}</CardTitle>
          <Button
            data-icon="inline-start"
            disabled={!isMudirDesktop()}
            onClick={() => {
              refreshAudit().catch(() => undefined);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden />
            {t("common.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="max-h-96 space-y-2 overflow-y-auto">
          {audit.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t("common.empty")}</p>
          ) : (
            audit.map((row) => (
              <Card className="shadow-none" key={row.id}>
                <CardContent className="p-3 text-xs">
                  <div className="font-mono opacity-70">{row.created_at}</div>
                  <div>
                    <span className="font-medium">{row.action}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {row.entity}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {" "}
                      {row.entity_id.slice(0, 12)}…
                    </span>
                  </div>
                  {row.payload ? (
                    <div className="mt-1 break-all opacity-80">
                      {row.payload}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
