const TOURS_KEY = "mudir-onboarding-tours";
const CHECKLIST_DISMISSED_KEY = "mudir-checklist-dismissed";

export function getCompletedTours(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(TOURS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function markTourCompleted(tourId: string): void {
  const completed = getCompletedTours();
  if (completed.includes(tourId)) {
    return;
  }
  localStorage.setItem(TOURS_KEY, JSON.stringify([...completed, tourId]));
}

export function isTourCompleted(tourId: string): boolean {
  return getCompletedTours().includes(tourId);
}

export function resetAllTours(): void {
  localStorage.removeItem(TOURS_KEY);
}

export function isChecklistDismissed(): boolean {
  return localStorage.getItem(CHECKLIST_DISMISSED_KEY) === "1";
}

export function dismissChecklist(): void {
  localStorage.setItem(CHECKLIST_DISMISSED_KEY, "1");
}

export function resetChecklistDismissed(): void {
  localStorage.removeItem(CHECKLIST_DISMISSED_KEY);
}
