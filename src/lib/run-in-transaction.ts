import { loadAppDatabase } from "@/lib/app-db";

type AppDb = Awaited<ReturnType<typeof loadAppDatabase>>;

/** یک اتصال؛ BEGIN IMMEDIATE … COMMIT / ROLLBACK برای عملیات اتمیک. */
export async function runInTransaction(
  steps: (db: AppDb) => Promise<void>
): Promise<void> {
  const db = await loadAppDatabase();
  await db.execute("BEGIN IMMEDIATE");
  try {
    await steps(db);
    await db.execute("COMMIT");
  } catch (e) {
    try {
      await db.execute("ROLLBACK");
    } catch {
      /* ignore rollback errors */
    }
    throw e;
  }
}
