import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { requireOperatorId } from "@/bridge/users";
import { loadAppDatabase, selectFirstRow } from "@/lib/app-db";
import { appendAuditLog } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";

export async function getTotalApOutstanding(): Promise<number> {
  if (!isTauri()) {
    return 0;
  }
  const db = await loadAppDatabase();
  const raw = await selectFirstRow<{ total: number }>(
    db,
    "SELECT COALESCE(SUM(balance_due), 0) AS total FROM purchases WHERE balance_due > 0"
  );
  return raw?.total ?? 0;
}

export async function recordPurchasePayment(input: {
  amount: number;
  method?: string;
  notes?: string;
  paymentDate: string;
  purchaseId: string;
  reference?: string;
}): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const operatorId = await requireOperatorId();
  const db = await loadAppDatabase();
  const purchaseRaw = await db.select<unknown>(
    "SELECT id, total_cost, amount_paid, balance_due, currency_code, exchange_rate FROM purchases WHERE id = $1",
    [input.purchaseId]
  );
  const purchases = z
    .array(
      z.object({
        amount_paid: z.coerce.number(),
        balance_due: z.coerce.number(),
        currency_code: z.string(),
        exchange_rate: z.coerce.number(),
        id: z.string(),
        total_cost: z.coerce.number(),
      })
    )
    .parse(purchaseRaw);
  const purchase = purchases[0];
  if (!purchase) {
    throw new Error("validation.purchaseNotFound");
  }

  const paymentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const newPaid = purchase.amount_paid + input.amount;
  const newBalance = Math.max(0, purchase.total_cost - newPaid);

  await runInTransaction(async (dbTx) => {
    await dbTx.execute(
      `INSERT INTO purchase_payments (id, purchase_id, amount, currency_code, exchange_rate, method, payment_date, reference, notes, operator_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        paymentId,
        input.purchaseId,
        input.amount,
        purchase.currency_code,
        purchase.exchange_rate,
        input.method ?? "bank_transfer",
        input.paymentDate,
        input.reference ?? null,
        input.notes ?? null,
        operatorId,
        now,
      ]
    );
    await dbTx.execute(
      "UPDATE purchases SET amount_paid = $1, balance_due = $2 WHERE id = $3",
      [newPaid, newBalance, input.purchaseId]
    );
    await appendAuditLog(dbTx, {
      action: "purchase.payment",
      actorUserId: operatorId,
      entity: "purchase",
      entityId: input.purchaseId,
      payload: JSON.stringify({ amount: input.amount }),
    });
  });
  return { id: paymentId };
}

export async function listPurchasePayments(purchaseId: string) {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, amount, method, payment_date, reference, notes, created_at FROM purchase_payments WHERE purchase_id = $1 ORDER BY payment_date DESC",
    [purchaseId]
  );
  return z
    .array(
      z.object({
        amount: z.coerce.number(),
        created_at: z.string(),
        id: z.string(),
        method: z.string(),
        notes: z.string().nullable(),
        payment_date: z.string(),
        reference: z.string().nullable(),
      })
    )
    .parse(raw);
}

export async function syncPurchaseBalance(purchaseId: string): Promise<void> {
  if (!isTauri()) {
    return;
  }
  const db = await loadAppDatabase();
  await db.execute(
    "UPDATE purchases SET balance_due = total_cost - amount_paid WHERE id = $1",
    [purchaseId]
  );
}
