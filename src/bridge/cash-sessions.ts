import { z } from "zod";
import {
  cashSessionCloseSchema,
  cashSessionOpenSchema,
} from "@/domain/finance/schemas";
import { loadAppDatabase } from "@/lib/app-db";
import { DEFAULT_AUDIT_ACTOR_ID, logAuditEvent } from "@/lib/audit-log";
import { isMudirDesktop } from "@/lib/runtime";

const sessionRowSchema = z.object({
  closed_at: z.string().nullable(),
  closing_balance: z.coerce.number().nullable(),
  id: z.string(),
  note: z.string().nullable(),
  opened_at: z.string(),
  opening_balance: z.coerce.number(),
});

export type CashSessionRow = z.infer<typeof sessionRowSchema>;

export async function getOpenCashSession(): Promise<CashSessionRow | null> {
  if (!isMudirDesktop()) {
    return null;
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, opened_at, closed_at, opening_balance, closing_balance, note FROM cash_sessions WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1"
  );
  const rows = z.array(sessionRowSchema).parse(raw);
  return rows[0] ?? null;
}

export async function openCashSession(raw: unknown): Promise<{ id: string }> {
  if (!isMudirDesktop()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = cashSessionOpenSchema.parse(raw);
  const open = await getOpenCashSession();
  if (open) {
    throw new Error("validation.cashSessionAlreadyOpen");
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = await loadAppDatabase();
  await db.execute(
    "INSERT INTO cash_sessions (id, opened_at, closed_at, opening_balance, closing_balance, note) VALUES ($1, $2, NULL, $3, NULL, $4)",
    [id, now, input.openingBalance, input.note ?? null]
  );
  await logAuditEvent({
    action: "cash_session.opened",
    actorUserId: DEFAULT_AUDIT_ACTOR_ID,
    entity: "cash_session",
    entityId: id,
    payload: JSON.stringify({ openingBalance: input.openingBalance }),
  });
  return { id };
}

export async function closeCashSession(raw: unknown): Promise<void> {
  if (!isMudirDesktop()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = cashSessionCloseSchema.parse(raw);
  const db = await loadAppDatabase();
  const check = await db.select<unknown>(
    "SELECT id FROM cash_sessions WHERE id = $1 AND closed_at IS NULL",
    [input.sessionId]
  );
  const found = z.array(z.object({ id: z.string() })).parse(check);
  if (found.length === 0) {
    throw new Error("validation.cashSessionNotFound");
  }
  const now = new Date().toISOString();
  await db.execute(
    "UPDATE cash_sessions SET closed_at = $1, closing_balance = $2 WHERE id = $3",
    [now, input.closingBalance, input.sessionId]
  );
  await logAuditEvent({
    action: "cash_session.closed",
    actorUserId: DEFAULT_AUDIT_ACTOR_ID,
    entity: "cash_session",
    entityId: input.sessionId,
    payload: JSON.stringify({ closingBalance: input.closingBalance }),
  });
}
