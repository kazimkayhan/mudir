"use client";

import { CircleHelp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTourOptional } from "@/components/onboarding/tour-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tourIdForPath } from "@/domain/onboarding/tours";
import { useTranslations } from "@/i18n/hooks";
import {
  resetAllTours,
  resetChecklistDismissed,
} from "@/lib/onboarding-storage";

export function HelpMenu() {
  const t = useTranslations();
  const pathname = usePathname();
  const tour = useTourOptional();
  const pageTourId = tourIdForPath(pathname);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("onboarding.help.title")}
          data-tour="help-menu"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <CircleHelp aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/dashboard">{t("onboarding.help.checklist")}</Link>
        </DropdownMenuItem>
        {pageTourId && tour ? (
          <DropdownMenuItem
            onClick={() => {
              tour.startTour(pageTourId);
            }}
          >
            {t("onboarding.help.replayTour")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onClick={() => {
            resetAllTours();
            resetChecklistDismissed();
          }}
        >
          {t("onboarding.help.reset")}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings#help">{t("onboarding.help.settings")}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
