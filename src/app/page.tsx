"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useI18n } from "@/i18n/hooks";

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <p className="p-6 text-muted-foreground text-sm">
      {t("dashboard.redirecting")}
    </p>
  );
}
