/**
 * بارگذاری دیتابیس اپ همراستا با `sqlite:mudir.db` در Rust (`tauri-plugin-sql`).
 * فقط در WebView/Tauri فراخوانی کنید؛ در `next dev` مرورگر معمولی خطا می‌دهد.
 */
export async function loadAppDatabase() {
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  return Database.load("sqlite:mudir.db");
}
