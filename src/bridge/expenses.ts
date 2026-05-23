import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { getBusinessSettings } from "@/bridge/settings";
import { requireOperatorId } from "@/bridge/users";
import { expenseWriteSchema } from "@/domain/finance/schemas";
import { loadAppDatabase } from "@/lib/app-db";
import { appendAuditLog } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";

const expenseRowSchema = z.object({
  amount: z.coerce.number(),
  category: z.string(),
  created_at: z.string(),
  currency_code: z.string(),
  exchange_rate: z.coerce.number(),
  id: z.string(),
  note: z.string().nullable(),
});

export type ExpenseRow = z.infer<typeof expenseRowSchema>;

export async function listExpenses(limit = 200): Promise<ExpenseRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, category, amount, note, currency_code, exchange_rate, created_at FROM expenses ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return z.array(expenseRowSchema).parse(raw);
}

export async function insertExpense(raw: unknown): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = expenseWriteSchema.parse(raw);
  const operatorId = await requireOperatorId();
  const settings = await getBusinessSettings();
  const currencyCode = input.currency_code ?? settings.baseCurrency;
  const exchangeRate = currencyCode === "USD" ? settings.usdToAfnRate : 1;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await runInTransaction(async (db) => {
    await db.execute(
      "INSERT INTO expenses (id, category, amount, note, operator_id, currency_code, exchange_rate, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        id,
        input.category,
        input.amount,
        input.note ?? null,
        operatorId,
        currencyCode,
        exchangeRate,
        now,
      ]
    );
    await appendAuditLog(db, {
      action: "expense.created",
      actorUserId: operatorId,
      entity: "expense",
      entityId: id,
      payload: JSON.stringify({
        amount: input.amount,
        category: input.category,
      }),
    });
  });
  return { id };
}

export async function updateExpense(raw: {
  id: string;
  category: string;
  amount: number;
  note?: string;
  currency_code?: "AFN" | "USD";
}): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const operatorId = await requireOperatorId();
  const settings = await getBusinessSettings();
  const currencyCode = raw.currency_code ?? settings.baseCurrency;
  const exchangeRate = currencyCode === "USD" ? settings.usdToAfnRate : 1;
  await runInTransaction(async (db) => {
    await db.execute(
      "UPDATE expenses SET category = $1, amount = $2, note = $3, currency_code = $4, exchange_rate = $5 WHERE id = $6",
      [
        raw.category,
        raw.amount,
        raw.note ?? null,
        currencyCode,
        exchangeRate,
        raw.id,
      ]
    );
    await appendAuditLog(db, {
      action: "expense.updated",
      actorUserId: operatorId,
      entity: "expense",
      entityId: raw.id,
    });
  });
}

export async function deleteExpense(id: string): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const operatorId = await requireOperatorId();
  await runInTransaction(async (db) => {
    await db.execute("DELETE FROM expenses WHERE id = $1", [id]);
    await appendAuditLog(db, {
      action: "expense.deleted",
      actorUserId: operatorId,
      entity: "expense",
      entityId: id,
    });
  });
}

export async function getTotalExpensesSince(isoDate: string): Promise<number> {
  if (!isTauri()) {
    return 0;
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE created_at >= $1",
    [isoDate]
  );
  const rows = z.array(z.object({ total: z.coerce.number() })).parse(raw);
  return rows[0]?.total ?? 0;
}
