import { isTauri } from "@tauri-apps/api/core";

/** True when Mudir can use SQLite via tauri-plugin-sql (desktop webview). */
export function isMudirDesktop(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (isTauri()) {
    return true;
  }
  return (
    "__TAURI_INTERNALS__" in window ||
    "__TAURI__" in window ||
    window.location.protocol === "tauri:" ||
    window.location.hostname === "tauri.localhost"
  );
}
