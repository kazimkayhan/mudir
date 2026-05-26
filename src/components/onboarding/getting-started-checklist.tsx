"use client";

import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getOnboardingProgress,
  type OnboardingProgress,
} from "@/bridge/onboarding-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/hooks";
import {
  dismissChecklist,
  isChecklistDismissed,
} from "@/lib/onboarding-storage";
import { routeLiteral } from "@/lib/route";

interface ChecklistItem {
  complete: (progress: OnboardingProgress) => boolean;
  href: string;
  id: string;
  labelKey:
    | "onboarding.checklist.product"
    | "onboarding.checklist.customer"
    | "onboarding.checklist.invoice"
    | "onboarding.checklist.payment"
    | "onboarding.checklist.pos"
    | "onboarding.checklist.backup";
}

const ITEMS: ChecklistItem[] = [
  {
    complete: (p) => p.productCount > 0,
    href: "/products",
    id: "product",
    labelKey: "onboarding.checklist.product",
  },
  {
    complete: (p) => p.customerCount > 0,
    href: "/customers",
    id: "customer",
    labelKey: "onboarding.checklist.customer",
  },
  {
    complete: (p) => p.invoiceCount > 0,
    href: "/invoices/new",
    id: "invoice",
    labelKey: "onboarding.checklist.invoice",
  },
  {
    complete: (p) => p.paymentCount > 0,
    href: "/invoices",
    id: "payment",
    labelKey: "onboarding.checklist.payment",
  },
  {
    complete: (p) => p.saleCount > 0,
    href: "/pos",
    id: "pos",
    labelKey: "onboarding.checklist.pos",
  },
  {
    complete: (p) => p.backupToday,
    href: "/settings#backup",
    id: "backup",
    labelKey: "onboarding.checklist.backup",
  },
];

export function GettingStartedChecklist() {
  const { t } = useI18n();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(async () => {
    setProgress(await getOnboardingProgress());
  }, []);

  useEffect(() => {
    setDismissed(isChecklistDismissed());
    refresh().catch(() => undefined);
  }, [refresh]);

  if (dismissed || !progress) {
    return null;
  }

  const doneCount = ITEMS.filter((item) => item.complete(progress)).length;
  const allDone = doneCount === ITEMS.length;

  if (allDone && collapsed) {
    return null;
  }

  return (
    <Card className="mt-6" data-tour="getting-started-checklist">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">
          {t("onboarding.checklist.title")}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            aria-label={collapsed ? t("common.view") : t("common.close")}
            onClick={() => setCollapsed((value) => !value)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            {collapsed ? (
              <ChevronDown aria-hidden />
            ) : (
              <ChevronUp aria-hidden />
            )}
          </Button>
          {allDone ? (
            <Button
              aria-label={t("onboarding.checklist.hide")}
              onClick={() => {
                dismissChecklist();
                setDismissed(true);
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      {collapsed ? null : (
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            {t("onboarding.checklist.progress", {
              done: String(doneCount),
              total: String(ITEMS.length),
            })}
          </p>
          <ul className="space-y-2">
            {ITEMS.map((item) => {
              const done = item.complete(progress);
              return (
                <li
                  className="flex items-center justify-between gap-2 text-sm"
                  key={item.id}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={
                        done
                          ? "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                          : "size-5 rounded-full border"
                      }
                    >
                      {done ? <Check aria-hidden className="size-3" /> : null}
                    </span>
                    {t(item.labelKey)}
                  </span>
                  {done ? null : (
                    <Button asChild size="sm" type="button" variant="outline">
                      <Link href={routeLiteral(item.href)}>
                        {t("common.view")}
                      </Link>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
