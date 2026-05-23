import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { requireOperatorId } from "@/bridge/users";
import { loadAppDatabase } from "@/lib/app-db";
import { appendAuditLog } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";

const customerRowSchema = z.object({
  address: z.string().nullable(),
  created_at: z.string(),
  id: z.string(),
  name: z.string(),
  note: z.string().nullable(),
  phone: z.string().nullable(),
});

export type CustomerRow = z.infer<typeof customerRowSchema>;

export async function listCustomers(limit = 500): Promise<CustomerRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, name, phone, address, note, created_at FROM customers ORDER BY name COLLATE NOCASE LIMIT $1",
    [limit]
  );
  return z.array(customerRowSchema).parse(raw);
}

export async function insertCustomer(raw: {
  name: string;
  phone?: string;
  address?: string;
  note?: string;
}): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const name = raw.name.trim();
  if (!name) {
    throw new Error("validation.nameRequired");
  }
  const operatorId = await requireOperatorId();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await runInTransaction(async (db) => {
    await db.execute(
      "INSERT INTO customers (id, name, phone, address, note, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        id,
        name,
        raw.phone?.trim() || null,
        raw.address?.trim() || null,
        raw.note?.trim() || null,
        now,
      ]
    );
    await appendAuditLog(db, {
      action: "customer.created",
      actorUserId: operatorId,
      entity: "customer",
      entityId: id,
      payload: JSON.stringify({ name }),
    });
  });
  return { id };
}

export async function updateCustomer(raw: {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  note?: string;
}): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const operatorId = await requireOperatorId();
  await runInTransaction(async (db) => {
    await db.execute(
      "UPDATE customers SET name = $1, phone = $2, address = $3, note = $4 WHERE id = $5",
      [
        raw.name.trim(),
        raw.phone?.trim() || null,
        raw.address?.trim() || null,
        raw.note?.trim() || null,
        raw.id,
      ]
    );
    await appendAuditLog(db, {
      action: "customer.updated",
      actorUserId: operatorId,
      entity: "customer",
      entityId: raw.id,
    });
  });
}

export async function getCustomerById(id: string): Promise<CustomerRow | null> {
  if (!isTauri()) {
    return null;
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, name, phone, address, note, created_at FROM customers WHERE id = $1",
    [id]
  );
  const rows = z.array(customerRowSchema).parse(raw);
  return rows[0] ?? null;
}

export async function listSalesForCustomer(
  customerId: string,
  limit = 50
): Promise<
  { id: string; total_amount: number; channel: string; created_at: string }[]
> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, total_amount, channel, created_at FROM sales WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2",
    [customerId, limit]
  );
  return z
    .array(
      z.object({
        channel: z.string(),
        created_at: z.string(),
        id: z.string(),
        total_amount: z.coerce.number(),
      })
    )
    .parse(raw);
}

export async function listOrdersForCustomer(
  customerId: string,
  limit = 50
): Promise<
  { id: string; status: string; total_amount: number; created_at: string }[]
> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, status, total_amount, created_at FROM online_orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2",
    [customerId, limit]
  );
  return z
    .array(
      z.object({
        created_at: z.string(),
        id: z.string(),
        status: z.string(),
        total_amount: z.coerce.number(),
      })
    )
    .parse(raw);
}
