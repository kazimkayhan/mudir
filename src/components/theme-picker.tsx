"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/hooks";
import {
  applyTheme,
  resolveTheme,
  setStoredTheme,
  type ThemeMode,
} from "@/lib/theme";

interface ThemePickerProps {
  onChange?: (mode: ThemeMode) => void;
  value: ThemeMode;
}

const options: {
  mode: ThemeMode;
  icon: typeof Sun;
  labelKey: "shell.themeLight" | "shell.themeDark" | "shell.themeSystem";
}[] = [
  { icon: Sun, labelKey: "shell.themeLight", mode: "light" },
  { icon: Moon, labelKey: "shell.themeDark", mode: "dark" },
  { icon: Monitor, labelKey: "shell.themeSystem", mode: "system" },
];

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  const t = useTranslations();

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map(({ mode, icon: Icon, labelKey }) => {
        const selected = value === mode;
        return (
          <Button
            aria-pressed={selected}
            className="h-auto flex-col gap-2 py-4"
            key={mode}
            onClick={() => {
              setStoredTheme(mode);
              applyTheme(resolveTheme(mode));
              onChange?.(mode);
            }}
            type="button"
            variant={selected ? "default" : "outline"}
          >
            <Icon aria-hidden className="size-5" />
            <span>{t(labelKey)}</span>
          </Button>
        );
      })}
    </div>
  );
}
