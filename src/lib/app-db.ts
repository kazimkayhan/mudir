/**
 * بارگذاری دیتابیس اپ همراستا با `sqlite:mudir.db` در Rust (`tauri-plugin-sql`).
 * فقط در WebView/Tauri فراخوانی کنید؛ در `next dev` مرورگر معمولی خطا می‌دهد.
 */
export async function loadAppDatabase() {
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  return Database.load("sqlite:mudir.db");
}

type SqlDb = Awaited<ReturnType<typeof loadAppDatabase>>;

/** `tauri-plugin-sql` may return one row or an array depending on the query. */
export async function selectRows<T>(
  db: SqlDb,
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const raw = await db.select<T>(sql, params);
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw == null) {
    return [];
  }
  return [raw];
}

export async function selectFirstRow<T>(
  db: SqlDb,
  sql: string,
  params?: unknown[]
): Promise<T | undefined> {
  return (await selectRows<T>(db, sql, params))[0];
}
