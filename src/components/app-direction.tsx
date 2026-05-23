"use client";

import { useEffect } from "react";
import { DirectionProvider } from "@/components/ui/direction";
import { useI18n } from "@/i18n/hooks";

export function AppDirection({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n();
  const dir = locale === "en" ? "ltr" : "rtl";

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = locale === "fa-AF" ? "fa-AF" : "en";
  }, [dir, locale]);

  return <DirectionProvider dir={dir}>{children}</DirectionProvider>;
}
