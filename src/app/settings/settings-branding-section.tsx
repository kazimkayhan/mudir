"use client";

import { Upload } from "lucide-react";
import { pickAndCopyCompanyAsset } from "@/bridge/company-assets";
import { type BusinessSettings, saveBusinessSettings } from "@/bridge/settings";
import { AssetPreview } from "@/components/asset-preview";
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
import { useI18n } from "@/i18n/hooks";
import { isMudirDesktop } from "@/lib/runtime";

interface SettingsBrandingSectionProps {
  profile: BusinessSettings | null;
  setProfile: (profile: BusinessSettings) => void;
}

export function SettingsBrandingSection({
  profile,
  setProfile,
}: SettingsBrandingSectionProps) {
  const { t } = useI18n();

  const pickAsset = async (kind: "logo" | "stamp" | "signature") => {
    if (!profile) {
      return;
    }
    const path = await pickAndCopyCompanyAsset(kind);
    if (!path) {
      return;
    }
    let pathField: "logoPath" | "stampPath" | "signaturePath";
    if (kind === "logo") {
      pathField = "logoPath";
    } else if (kind === "stamp") {
      pathField = "stampPath";
    } else {
      pathField = "signaturePath";
    }
    const next = { ...profile, [pathField]: path };
    setProfile(next);
    await saveBusinessSettings({
      logoPath: next.logoPath,
      signaturePath: next.signaturePath,
      stampPath: next.stampPath,
    });
  };

  return (
    <Card className="mt-8" id="branding">
      <CardHeader>
        <CardTitle>{t("settings.branding")}</CardTitle>
        <CardDescription>{t("settings.brandingDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <AssetCard
            label={t("setup.logo")}
            onPick={() => {
              pickAsset("logo").catch(() => undefined);
            }}
            path={profile?.logoPath}
            variant="logo"
          />
          <AssetCard
            label={t("setup.stamp")}
            onPick={() => {
              pickAsset("stamp").catch(() => undefined);
            }}
            path={profile?.stampPath}
            variant="stamp"
          />
          <AssetCard
            label={t("setup.signature")}
            onPick={() => {
              pickAsset("signature").catch(() => undefined);
            }}
            path={profile?.signaturePath}
            variant="stamp"
          />
        </div>
        {profile ? (
          <Field>
            <Label>{t("setup.pdfAccentColor")}</Label>
            <Input
              onBlur={() => {
                saveBusinessSettings({
                  pdfAccentColor: profile.pdfAccentColor,
                }).catch(() => undefined);
              }}
              onChange={(e) =>
                setProfile({ ...profile, pdfAccentColor: e.target.value })
              }
              type="color"
              value={profile.pdfAccentColor}
            />
          </Field>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AssetCard({
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
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border p-4 text-center">
      <p className="font-medium text-sm">{label}</p>
      <AssetPreview className="mx-auto" path={path} variant={variant} />
      <Button
        className="w-full"
        data-icon="inline-start"
        disabled={!isMudirDesktop()}
        onClick={onPick}
        size="sm"
        type="button"
        variant="outline"
      >
        <Upload aria-hidden />
        {t("common.upload")}
      </Button>
    </div>
  );
}
