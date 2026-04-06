import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { expenseWriteSchema } from "@/domain/finance/schemas";
import { loadAppDatabase } from "@/lib/app-db";
import { DEFAULT_AUDIT_ACTOR_ID, logAuditEvent } from "@/lib/audit-log";

const expenseRowSchema = z.object({
  id: z.string(),
  category: z.string(),
  amount: z.coerce.number(),
  note: z.string().nullable(),
  created_at: z.string(),
});

export type ExpenseRow = z.infer<typeof expenseRowSchema>;

export async function listExpenses(limit = 200): Promise<ExpenseRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, category, amount, note, created_at FROM expenses ORDER BY created_at DESC LIMIT $1",
    [limit],
  );
  return z.array(expenseRowSchema).parse(raw);
}

export async function insertExpense(raw: unknown): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("Database is only available inside the Tauri app.");
  }
  const input = expenseWriteSchema.parse(raw);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = await loadAppDatabase();
  await db.execute(
    "INSERT INTO expenses (id, category, amount, note, created_at) VALUES ($1, $2, $3, $4, $5)",
    [id, input.category, input.amount, input.note ?? null, now],
  );
  await logAuditEvent({
    actorUserId: DEFAULT_AUDIT_ACTOR_ID,
    action: "expense.created",
    entity: "expense",
    entityId: id,
    payload: JSON.stringify({
      category: input.category,
      amount: input.amount,
    }),
  });
  return { id };
}
