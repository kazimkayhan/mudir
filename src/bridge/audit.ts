import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { loadAppDatabase } from "@/lib/app-db";

const auditRowSchema = z.object({
  id: z.string(),
  actor_user_id: z.string(),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string(),
  payload: z.string().nullable(),
  created_at: z.string(),
});

export type AuditLogRow = z.infer<typeof auditRowSchema>;

export async function listRecentAuditLogs(limit = 80): Promise<AuditLogRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `SELECT id, actor_user_id, action, entity, entity_id, payload, created_at
     FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return z.array(auditRowSchema).parse(raw);
}
