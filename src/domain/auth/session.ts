import type { Role } from "@/domain/types";

export interface StoredSession {
  email: string;
  expiresAt: string;
  id: string;
  name: string;
  role: Role;
}

export const SESSION_STORAGE_KEY = "mudir-session";
export const REMEMBER_STORAGE_KEY = "mudir-session-remember";

const SESSION_HOURS = 12;
const REMEMBER_DAYS = 30;

export function createSessionExpiry(remember: boolean): string {
  const ms = remember
    ? REMEMBER_DAYS * 24 * 60 * 60 * 1000
    : SESSION_HOURS * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

export function isSessionValid(session: StoredSession | null): boolean {
  if (!(session?.id && session.expiresAt)) {
    return false;
  }
  return new Date(session.expiresAt).getTime() > Date.now();
}

export function getStoredSession(): StoredSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  for (const key of [SESSION_STORAGE_KEY, REMEMBER_STORAGE_KEY]) {
    const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    if (!raw) {
      continue;
    }
    try {
      const session = JSON.parse(raw) as StoredSession;
      if (isSessionValid(session)) {
        return session;
      }
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  }
  return null;
}

export function setStoredSession(
  session: StoredSession | null,
  remember = false
): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(REMEMBER_STORAGE_KEY);
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStorage.removeItem(REMEMBER_STORAGE_KEY);
  if (!session) {
    return;
  }
  const raw = JSON.stringify(session);
  if (remember) {
    localStorage.setItem(REMEMBER_STORAGE_KEY, raw);
  } else {
    sessionStorage.setItem(SESSION_STORAGE_KEY, raw);
  }
}

const LOCKOUT_KEY = "mudir-login-lockout";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface LockoutState {
  attempts: number;
  lockedUntil: string | null;
}

export function getLockoutState(): LockoutState {
  if (typeof window === "undefined") {
    return { attempts: 0, lockedUntil: null };
  }
  const raw = localStorage.getItem(LOCKOUT_KEY);
  if (!raw) {
    return { attempts: 0, lockedUntil: null };
  }
  try {
    return JSON.parse(raw) as LockoutState;
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

export function isLoginLocked(): boolean {
  const state = getLockoutState();
  if (!state.lockedUntil) {
    return false;
  }
  if (new Date(state.lockedUntil).getTime() <= Date.now()) {
    clearLoginLockout();
    return false;
  }
  return true;
}

export function recordFailedLogin(): void {
  const state = getLockoutState();
  const attempts = state.attempts + 1;
  const next: LockoutState =
    attempts >= MAX_ATTEMPTS
      ? {
          attempts,
          lockedUntil: new Date(Date.now() + LOCKOUT_MS).toISOString(),
        }
      : { attempts, lockedUntil: null };
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(next));
}

export function clearLoginLockout(): void {
  localStorage.removeItem(LOCKOUT_KEY);
}
