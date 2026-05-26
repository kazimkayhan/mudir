"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { getTour, type TourDefinition } from "@/domain/onboarding/tours";
import { markTourCompleted } from "@/lib/onboarding-storage";

interface TourContextValue {
  activeStepIndex: number;
  activeTour: TourDefinition | null;
  skipTour: () => void;
  startTour: (tourId: string) => void;
  stepBack: () => void;
  stepNext: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [activeTour, setActiveTour] = useState<TourDefinition | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const activeTourIdRef = useRef<string | null>(null);

  const finishTour = useCallback((tourId: string) => {
    markTourCompleted(tourId);
    activeTourIdRef.current = null;
    setActiveTour(null);
    setActiveStepIndex(0);
  }, []);

  const startTour = useCallback((tourId: string) => {
    if (activeTourIdRef.current === tourId) {
      return;
    }
    const tour = getTour(tourId);
    if (!tour) {
      return;
    }
    activeTourIdRef.current = tourId;
    setActiveTour(tour);
    setActiveStepIndex(0);
  }, []);

  const skipTour = useCallback(() => {
    if (activeTour) {
      finishTour(activeTour.id);
    }
  }, [activeTour, finishTour]);

  const stepNext = useCallback(() => {
    if (!activeTour) {
      return;
    }
    if (activeStepIndex >= activeTour.steps.length - 1) {
      finishTour(activeTour.id);
      return;
    }
    setActiveStepIndex((index) => index + 1);
  }, [activeStepIndex, activeTour, finishTour]);

  const stepBack = useCallback(() => {
    setActiveStepIndex((index) => Math.max(0, index - 1));
  }, []);

  const value = useMemo(
    () => ({
      activeStepIndex,
      activeTour,
      skipTour,
      startTour,
      stepBack,
      stepNext,
    }),
    [activeStepIndex, activeTour, skipTour, startTour, stepBack, stepNext]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used within TourProvider");
  }
  return ctx;
}

export function useTourOptional(): TourContextValue | null {
  return useContext(TourContext);
}
