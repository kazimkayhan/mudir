"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTourOptional } from "@/components/onboarding/tour-provider";
import { tourIdForPath } from "@/domain/onboarding/tours";
import { isTourCompleted } from "@/lib/onboarding-storage";

export function useModuleTour(customTourId?: string, enabled = true) {
  const pathname = usePathname();
  const tour = useTourOptional();
  const startTourRef = useRef(tour?.startTour);
  startTourRef.current = tour?.startTour;

  const activeTourId = tour?.activeTour?.id ?? null;

  useEffect(() => {
    if (!(startTourRef.current && enabled)) {
      return;
    }
    const tourId = customTourId ?? tourIdForPath(pathname);
    if (!tourId || isTourCompleted(tourId)) {
      return;
    }
    if (tourId !== "app-shell" && !isTourCompleted("app-shell")) {
      return;
    }
    if (activeTourId === tourId) {
      return;
    }
    if (activeTourId && activeTourId !== tourId) {
      return;
    }

    const timer = window.setTimeout(() => {
      startTourRef.current?.(tourId);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [activeTourId, customTourId, enabled, pathname]);
}
