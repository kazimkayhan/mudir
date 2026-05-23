import { isTauri } from "@tauri-apps/api/core";
import { loadAppDatabase } from "@/lib/app-db";

/** تا وقتی کاربر واقعی نداریم؛ POS از `cashierId` واقعی استفاده می‌کند. */
export const DEFAULT_AUDIT_ACTOR_ID = "dev-operator";

export interface AuditAppendInput {
  action: string;
  actorUserId: string;
  entity: string;
  entityId: string;
  payload?: string;
}

type SqlDb = Awaited<ReturnType<typeof loadAppDatabase>>;

/** درج در همان اتصال تراکنش (ترجیح برای عملیات اتمیک). */
export async function appendAuditLog(
  db: SqlDb,
  input: AuditAppendInput
): Promise<void> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity, entity_id, payload, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      input.actorUserId,
      input.action,
      input.entity,
      input.entityId,
      input.payload ?? null,
      now,
    ]
  );
}

/** پس از عملیات تک‌مرحله‌ای بدون تراکنش مشترک. */
export async function logAuditEvent(input: AuditAppendInput): Promise<void> {
  if (!isTauri()) {
    return;
  }
  const db = await loadAppDatabase();
  await appendAuditLog(db, input);
}
