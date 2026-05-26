const WELCOME_STORAGE_KEY = "mudir-welcome-completed";

export function isWelcomeCompleted(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return localStorage.getItem(WELCOME_STORAGE_KEY) === "1";
}

export function markWelcomeCompleted(): void {
  localStorage.setItem(WELCOME_STORAGE_KEY, "1");
}
