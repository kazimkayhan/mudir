import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import {
  cashSessionCloseSchema,
  cashSessionOpenSchema,
} from "@/domain/finance/schemas";
import { loadAppDatabase } from "@/lib/app-db";
import { DEFAULT_AUDIT_ACTOR_ID, logAuditEvent } from "@/lib/audit-log";

const sessionRowSchema = z.object({
  id: z.string(),
  opened_at: z.string(),
  closed_at: z.string().nullable(),
  opening_balance: z.coerce.number(),
  closing_balance: z.coerce.number().nullable(),
  note: z.string().nullable(),
});

export type CashSessionRow = z.infer<typeof sessionRowSchema>;

export async function getOpenCashSession(): Promise<CashSessionRow | null> {
  if (!isTauri()) {
    return null;
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, opened_at, closed_at, opening_balance, closing_balance, note FROM cash_sessions WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1",
  );
  const rows = z.array(sessionRowSchema).parse(raw);
  return rows[0] ?? null;
}

export async function openCashSession(raw: unknown): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("Database is only available inside the Tauri app.");
  }
  const input = cashSessionOpenSchema.parse(raw);
  const open = await getOpenCashSession();
  if (open) {
    throw new Error("A cash session is already open. Close it first.");
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = await loadAppDatabase();
  await db.execute(
    "INSERT INTO cash_sessions (id, opened_at, closed_at, opening_balance, closing_balance, note) VALUES ($1, $2, NULL, $3, NULL, $4)",
    [id, now, input.openingBalance, input.note ?? null],
  );
  await logAuditEvent({
    actorUserId: DEFAULT_AUDIT_ACTOR_ID,
    action: "cash_session.opened",
    entity: "cash_session",
    entityId: id,
    payload: JSON.stringify({ openingBalance: input.openingBalance }),
  });
  return { id };
}

export async function closeCashSession(raw: unknown): Promise<void> {
  if (!isTauri()) {
    throw new Error("Database is only available inside the Tauri app.");
  }
  const input = cashSessionCloseSchema.parse(raw);
  const db = await loadAppDatabase();
  const check = await db.select<unknown>(
    "SELECT id FROM cash_sessions WHERE id = $1 AND closed_at IS NULL",
    [input.sessionId],
  );
  const found = z.array(z.object({ id: z.string() })).parse(check);
  if (found.length === 0) {
    throw new Error("Open session not found.");
  }
  const now = new Date().toISOString();
  await db.execute(
    "UPDATE cash_sessions SET closed_at = $1, closing_balance = $2 WHERE id = $3",
    [now, input.closingBalance, input.sessionId],
  );
  await logAuditEvent({
    actorUserId: DEFAULT_AUDIT_ACTOR_ID,
    action: "cash_session.closed",
    entity: "cash_session",
    entityId: input.sessionId,
    payload: JSON.stringify({ closingBalance: input.closingBalance }),
  });
}
