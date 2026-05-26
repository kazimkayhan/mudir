"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/hooks";
import {
  applyTheme,
  initThemeListeners,
  readStoredThemeMode,
  resolveTheme,
  setStoredTheme,
  type ThemeMode,
} from "@/lib/theme";

const cycle: ThemeMode[] = ["light", "dark", "system"];

function themeToggleLabel(
  mode: ThemeMode,
  resolved: "light" | "dark",
  t: (
    key: "shell.themeLight" | "shell.themeDark" | "shell.themeSystem"
  ) => string
): string {
  if (mode === "system") {
    return t("shell.themeSystem");
  }
  return resolved === "dark" ? t("shell.themeLight") : t("shell.themeDark");
}

export function ThemeToggle() {
  const t = useTranslations();
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const current = readStoredThemeMode();
    setMode(current);
    applyTheme(resolveTheme(current));
    return initThemeListeners();
  }, []);

  function toggle() {
    const index = cycle.indexOf(mode);
    const next = cycle[(index + 1) % cycle.length] ?? "system";
    setMode(next);
    setStoredTheme(next);
  }

  const resolved = resolveTheme(mode);
  const label = themeToggleLabel(mode, resolved, t);

  let icon = <Moon aria-hidden />;
  if (mode === "system") {
    icon = <Monitor aria-hidden />;
  } else if (resolved === "dark") {
    icon = <Sun aria-hidden />;
  }

  return (
    <Button
      aria-label={label}
      onClick={toggle}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      {icon}
    </Button>
  );
}
