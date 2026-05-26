"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTour } from "@/components/onboarding/tour-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslations } from "@/i18n/hooks";
import {
  computeTourPopoverStyle,
  type TargetRect,
} from "@/lib/tour-popover-position";

export function TourSpotlight() {
  const t = useTranslations();
  const { activeTour, activeStepIndex, skipTour, stepBack, stepNext } =
    useTour();
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({
    left: 16,
    maxWidth: 320,
    top: 16,
  });

  const step = activeTour?.steps[activeStepIndex];

  useEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }

    const update = () => {
      const el = document.querySelector(step.target);
      if (!el) {
        setRect(null);
        setPopoverStyle(computeTourPopoverStyle(null));
        return;
      }
      const box = el.getBoundingClientRect();
      const nextRect: TargetRect = {
        height: box.height + 8,
        left: box.left - 4,
        top: box.top - 4,
        width: box.width + 8,
      };
      setRect(nextRect);
      setPopoverStyle(computeTourPopoverStyle(nextRect));
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const timer = window.setTimeout(update, 100);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearTimeout(timer);
    };
  }, [step]);

  if (!(activeTour && step)) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <button
        aria-label={t("onboarding.skipTour")}
        className="pointer-events-auto absolute inset-0 bg-black/50"
        onClick={skipTour}
        type="button"
      />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background"
          style={{
            height: rect.height,
            left: rect.left,
            top: rect.top,
            width: rect.width,
          }}
        />
      ) : null}
      <Card
        className="pointer-events-auto absolute z-10 shadow-lg"
        style={popoverStyle}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t(step.titleKey)}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          {t(step.bodyKey)}
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button onClick={skipTour} type="button" variant="ghost">
            {t("onboarding.skipTour")}
          </Button>
          <div className="flex gap-2">
            <Button
              data-icon="inline-start"
              disabled={activeStepIndex === 0}
              onClick={stepBack}
              type="button"
              variant="outline"
            >
              <ChevronLeft aria-hidden />
              {t("common.back")}
            </Button>
            <Button data-icon="inline-end" onClick={stepNext} type="button">
              {activeStepIndex >= activeTour.steps.length - 1
                ? t("onboarding.finishTour")
                : t("common.next")}
              {activeStepIndex < activeTour.steps.length - 1 ? (
                <ChevronRight aria-hidden />
              ) : null}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
