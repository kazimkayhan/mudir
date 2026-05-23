"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/hooks";
import {
  applyTheme,
  readStoredTheme,
  setStoredTheme,
  type ThemeMode,
} from "@/lib/theme";

export function ThemeToggle() {
  const t = useTranslations();
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const current = readStoredTheme();
    setTheme(current);
    applyTheme(current);
  }, []);

  function toggle() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
  }

  const dark = theme === "dark";

  return (
    <Button
      aria-label={dark ? t("shell.themeLight") : t("shell.themeDark")}
      onClick={toggle}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
