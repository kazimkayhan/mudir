"use client";

import { ChevronRight, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemePicker } from "@/components/theme-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type AppLocale, setStoredLocale } from "@/i18n";
import { useI18n } from "@/i18n/hooks";
import {
  initThemeListeners,
  readStoredThemeMode,
  type ThemeMode,
} from "@/lib/theme";
import { markWelcomeCompleted } from "@/lib/welcome";

export default function WelcomePage() {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const [selectedLocale, setSelectedLocale] = useState<AppLocale>(locale);
  const [theme, setTheme] = useState<ThemeMode>("system");

  useEffect(() => {
    setTheme(readStoredThemeMode());
    return initThemeListeners();
  }, []);

  useEffect(() => {
    const dir = selectedLocale === "en" ? "ltr" : "rtl";
    document.documentElement.dir = dir;
    document.documentElement.lang = selectedLocale === "fa-AF" ? "fa-AF" : "en";
  }, [selectedLocale]);

  const continueToSetup = () => {
    setStoredLocale(selectedLocale);
    setLocale(selectedLocale);
    markWelcomeCompleted();
    router.replace("/setup");
  };

  return (
    <div className="flex min-h-svh flex-col bg-linear-to-br from-background via-background to-primary/5">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <Store aria-hidden className="size-10 text-primary" />
          <div>
            <h1 className="font-semibold text-3xl">{t("welcome.title")}</h1>
            <p className="mt-1 text-muted-foreground">
              {t("welcome.subtitle")}
            </p>
          </div>
        </div>

        <div className="space-y-8 rounded-xl border bg-card p-6 shadow-sm">
          <div>
            <Label>{t("welcome.language")}</Label>
            <Select
              onValueChange={(v) => setSelectedLocale(v as AppLocale)}
              value={selectedLocale}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fa-AF">{t("shell.dari")}</SelectItem>
                <SelectItem value="en">{t("shell.english")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-2 text-muted-foreground text-sm">
              {selectedLocale === "fa-AF"
                ? t("welcome.previewFa")
                : t("welcome.previewEn")}
            </p>
          </div>

          <div>
            <Label>{t("welcome.theme")}</Label>
            <div className="mt-2">
              <ThemePicker onChange={setTheme} value={theme} />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <Button
            className="w-fit"
            data-icon="inline-end"
            onClick={continueToSetup}
            type="button"
          >
            {t("welcome.continue")}
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
