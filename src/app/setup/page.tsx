"use client";

import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { pickAndCopyCompanyAsset } from "@/bridge/company-assets";
import { saveBusinessSettings } from "@/bridge/settings";
import { upsertOwnerAccount } from "@/bridge/users";
import { AssetPreview } from "@/components/asset-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { getStoredLocale } from "@/i18n";
import { useI18n } from "@/i18n/hooks";
import { translateError } from "@/lib/translate-error";

const STEPS = 7;

interface SetupForm {
  adminEmail: string;
  adminName: string;
  adminPassword: string;
  baseCurrency: "AFN" | "USD";
  businessRegistrationNumber: string;
  city: string;
  companyEmail: string;
  importLicenseNumber: string;
  invoiceFooterEn: string;
  invoiceFooterFa: string;
  invoicePrefix: string;
  legalName: string;
  locale: "fa-AF" | "en";
  logoPath?: string;
  pdfAccentColor: string;
  phone: string;
  province: string;
  signaturePath?: string;
  stampPath?: string;
  storeName: string;
  streetAddress: string;
  tradeName: string;
  usdToAfnRate: number;
  website: string;
}

const initialForm: SetupForm = {
  adminEmail: "",
  adminName: "",
  adminPassword: "",
  baseCurrency: "AFN",
  businessRegistrationNumber: "",
  city: "",
  companyEmail: "",
  importLicenseNumber: "",
  invoiceFooterEn: "Thank you for your business.",
  invoiceFooterFa: "سپاس از اعتماد شما",
  invoicePrefix: "INV-",
  legalName: "",
  locale: getStoredLocale(),
  pdfAccentColor: "#0891b2",
  phone: "",
  province: "",
  storeName: "",
  streetAddress: "",
  tradeName: "",
  usdToAfnRate: 70,
  website: "",
};

export default function SetupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<SetupForm>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (partial: Partial<SetupForm>) => {
    setForm((f) => ({ ...f, ...partial }));
  };

  const pickAsset = async (kind: "logo" | "stamp" | "signature") => {
    const path = await pickAndCopyCompanyAsset(kind);
    if (!path) {
      return;
    }
    if (kind === "logo") {
      patch({ logoPath: path });
    } else if (kind === "stamp") {
      patch({ stampPath: path });
    } else {
      patch({ signaturePath: path });
    }
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      if (form.adminPassword.length < 8) {
        setError(t("validation.passwordMinLength"));
        return;
      }
      await saveBusinessSettings({
        baseCurrency: form.baseCurrency,
        businessRegistrationNumber:
          form.businessRegistrationNumber || undefined,
        businessType: "importer_reseller",
        city: form.city || undefined,
        defaultLocale: getStoredLocale(),
        email: form.companyEmail || undefined,
        importLicenseNumber: form.importLicenseNumber || undefined,
        invoiceFooterEn: form.invoiceFooterEn || undefined,
        invoiceFooterFa: form.invoiceFooterFa || undefined,
        invoicePrefix: form.invoicePrefix,
        legalName: form.legalName || undefined,
        logoPath: form.logoPath,
        onboardingCompleted: true,
        pdfAccentColor: form.pdfAccentColor,
        phone: form.phone || undefined,
        province: form.province || undefined,
        signaturePath: form.signaturePath,
        stampPath: form.stampPath,
        storeName: form.storeName.trim(),
        streetAddress: form.streetAddress || undefined,
        tradeName: form.tradeName || undefined,
        usdToAfnRate: form.usdToAfnRate,
        website: form.website || undefined,
      });
      await upsertOwnerAccount({
        email: form.adminEmail,
        name: form.adminName,
        password: form.adminPassword,
      });
      router.replace("/login?setup=done");
    } catch (e: unknown) {
      setError(translateError(t, e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (step === 1 && !form.storeName.trim()) {
      setError(t("validation.nameRequired"));
      return;
    }
    if (
      step === 6 &&
      !(form.adminEmail && form.adminName && form.adminPassword)
    ) {
      setError(t("setup.adminRequired"));
      return;
    }
    setError(null);
    if (step < STEPS) {
      setStep((s) => s + 1);
    } else {
      finish().catch(() => undefined);
    }
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  return (
    <div className="flex min-h-svh flex-col bg-linear-to-br from-background via-background to-primary/5">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-8">
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(step / STEPS) * 100}%` }}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            {t("setup.step", { current: step, total: STEPS })}
          </p>
          <h1 className="mt-1 font-semibold text-2xl">
            {t(`setup.step${step}Title` as never)}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t(`setup.step${step}Desc` as never)}
          </p>
          <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-muted-foreground text-xs">
            {t(`setup.step${step}Hint` as never)}
          </p>
        </div>

        {error ? (
          <Alert className="mb-4" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {step === 1 ? (
            <FieldGroup>
              <Field>
                <Label>{t("setup.legalName")}</Label>
                <Input
                  onChange={(e) => patch({ legalName: e.target.value })}
                  value={form.legalName}
                />
              </Field>
              <Field>
                <Label>{t("setup.tradeName")}</Label>
                <Input
                  onChange={(e) =>
                    patch({
                      storeName: e.target.value,
                      tradeName: e.target.value,
                    })
                  }
                  value={form.tradeName}
                />
              </Field>
            </FieldGroup>
          ) : null}

          {step === 2 ? (
            <FieldGroup>
              <Field>
                <Label>{t("setup.importLicense")}</Label>
                <Input
                  onChange={(e) =>
                    patch({ importLicenseNumber: e.target.value })
                  }
                  value={form.importLicenseNumber}
                />
              </Field>
              <Field>
                <Label>{t("setup.businessRegistration")}</Label>
                <Input
                  onChange={(e) =>
                    patch({ businessRegistrationNumber: e.target.value })
                  }
                  value={form.businessRegistrationNumber}
                />
              </Field>
            </FieldGroup>
          ) : null}

          {step === 3 ? (
            <FieldGroup>
              <Field>
                <Label>{t("settings.phone")}</Label>
                <Input
                  onChange={(e) => patch({ phone: e.target.value })}
                  value={form.phone}
                />
              </Field>
              <Field>
                <Label>{t("setup.companyEmail")}</Label>
                <Input
                  onChange={(e) => patch({ companyEmail: e.target.value })}
                  type="email"
                  value={form.companyEmail}
                />
              </Field>
              <Field>
                <Label>{t("setup.website")}</Label>
                <Input
                  onChange={(e) => patch({ website: e.target.value })}
                  value={form.website}
                />
              </Field>
              <Field>
                <Label>{t("setup.province")}</Label>
                <Input
                  onChange={(e) => patch({ province: e.target.value })}
                  value={form.province}
                />
              </Field>
              <Field>
                <Label>{t("setup.city")}</Label>
                <Input
                  onChange={(e) => patch({ city: e.target.value })}
                  value={form.city}
                />
              </Field>
              <Field>
                <Label>{t("settings.address")}</Label>
                <Textarea
                  onChange={(e) => patch({ streetAddress: e.target.value })}
                  value={form.streetAddress}
                />
              </Field>
            </FieldGroup>
          ) : null}

          {step === 4 ? (
            <FieldGroup>
              <AssetPicker
                label={t("setup.logo")}
                onPick={() => pickAsset("logo").catch(() => undefined)}
                path={form.logoPath}
                variant="logo"
              />
              <AssetPicker
                label={t("setup.stamp")}
                onPick={() => pickAsset("stamp").catch(() => undefined)}
                path={form.stampPath}
                variant="stamp"
              />
              <AssetPicker
                label={t("setup.signature")}
                onPick={() => pickAsset("signature").catch(() => undefined)}
                path={form.signaturePath}
                variant="stamp"
              />
              <Field>
                <Label>{t("setup.pdfAccentColor")}</Label>
                <Input
                  onChange={(e) => patch({ pdfAccentColor: e.target.value })}
                  type="color"
                  value={form.pdfAccentColor}
                />
              </Field>
              <Field>
                <Label>{t("setup.invoiceFooterFa")}</Label>
                <Textarea
                  onChange={(e) => patch({ invoiceFooterFa: e.target.value })}
                  value={form.invoiceFooterFa}
                />
              </Field>
              <Field>
                <Label>{t("setup.invoiceFooterEn")}</Label>
                <Textarea
                  onChange={(e) => patch({ invoiceFooterEn: e.target.value })}
                  value={form.invoiceFooterEn}
                />
              </Field>
            </FieldGroup>
          ) : null}

          {step === 5 ? (
            <FieldGroup>
              <Field>
                <Label>{t("setup.baseCurrency")}</Label>
                <Select
                  onValueChange={(v) =>
                    patch({ baseCurrency: v as "AFN" | "USD" })
                  }
                  value={form.baseCurrency}
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
              <Field>
                <Label>{t("onboarding.exchangeRate")}</Label>
                <NumberInput
                  min={0}
                  onValueChange={(v) => patch({ usdToAfnRate: v ?? 0 })}
                  value={form.usdToAfnRate}
                />
              </Field>
              <Field>
                <Label>{t("setup.invoicePrefix")}</Label>
                <Input
                  onChange={(e) => patch({ invoicePrefix: e.target.value })}
                  value={form.invoicePrefix}
                />
              </Field>
            </FieldGroup>
          ) : null}

          {step === 6 ? (
            <FieldGroup>
              <Field>
                <Label>{t("setup.adminName")}</Label>
                <Input
                  onChange={(e) => patch({ adminName: e.target.value })}
                  value={form.adminName}
                />
              </Field>
              <Field>
                <Label>{t("auth.email")}</Label>
                <Input
                  onChange={(e) => patch({ adminEmail: e.target.value })}
                  type="email"
                  value={form.adminEmail}
                />
              </Field>
              <Field>
                <Label>{t("auth.password")}</Label>
                <Input
                  onChange={(e) => patch({ adminPassword: e.target.value })}
                  type="password"
                  value={form.adminPassword}
                />
              </Field>
            </FieldGroup>
          ) : null}

          {step === 7 ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">
                  {t("setup.tradeName")}:{" "}
                </span>
                {form.tradeName || form.storeName}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("auth.email")}:{" "}
                </span>
                {form.adminEmail}
              </p>
              <p className="text-muted-foreground">
                {t("setup.readyDescLogin")}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-between">
          <Button
            data-icon="inline-start"
            disabled={step === 1 || busy}
            onClick={back}
            type="button"
            variant="outline"
          >
            <ChevronLeft aria-hidden />
            {t("common.back")}
          </Button>
          <Button
            data-icon="inline-end"
            disabled={busy}
            onClick={next}
            type="button"
          >
            {step === STEPS ? t("setup.finish") : t("common.next")}
            {step < STEPS ? <ChevronRight aria-hidden /> : null}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AssetPicker({
  label,
  onPick,
  path,
  variant,
}: {
  label: string;
  onPick: () => void;
  path?: string;
  variant: "logo" | "stamp";
}) {
  return (
    <Field>
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-4">
        <AssetPreview path={path} variant={variant} />
        <Button
          data-icon="inline-start"
          onClick={onPick}
          type="button"
          variant="outline"
        >
          <Upload aria-hidden />
          {label}
        </Button>
      </div>
    </Field>
  );
}
