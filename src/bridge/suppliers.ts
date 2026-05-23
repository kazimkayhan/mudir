import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { requireOperatorId } from "@/bridge/users";
import { supplierWriteSchema } from "@/domain/finance/schemas";
import { loadAppDatabase } from "@/lib/app-db";
import { appendAuditLog } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";

const supplierRowSchema = z.object({
  created_at: z.string(),
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
});

export type SupplierRow = z.infer<typeof supplierRowSchema>;

export async function listSuppliers(): Promise<SupplierRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, name, phone, created_at FROM suppliers ORDER BY name COLLATE NOCASE"
  );
  return z.array(supplierRowSchema).parse(raw);
}

export async function insertSupplier(raw: unknown): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = supplierWriteSchema.parse(raw);
  const operatorId = await requireOperatorId();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await runInTransaction(async (db) => {
    await db.execute(
      "INSERT INTO suppliers (id, name, phone, created_at) VALUES ($1, $2, $3, $4)",
      [id, input.name, input.phone ?? null, now]
    );
    await appendAuditLog(db, {
      action: "supplier.created",
      actorUserId: operatorId,
      entity: "supplier",
      entityId: id,
      payload: JSON.stringify({ name: input.name }),
    });
  });
  return { id };
}

export async function updateSupplier(raw: {
  id: string;
  name: string;
  phone?: string;
}): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = supplierWriteSchema.parse(raw);
  const operatorId = await requireOperatorId();
  await runInTransaction(async (db) => {
    await db.execute(
      "UPDATE suppliers SET name = $1, phone = $2 WHERE id = $3",
      [input.name, input.phone ?? null, raw.id]
    );
    await appendAuditLog(db, {
      action: "supplier.updated",
      actorUserId: operatorId,
      entity: "supplier",
      entityId: raw.id,
    });
  });
}

export async function deleteSupplier(id: string): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const operatorId = await requireOperatorId();
  await runInTransaction(async (db) => {
    const refs = await db.select<unknown>(
      "SELECT 1 FROM purchases WHERE supplier_id = $1 LIMIT 1",
      [id]
    );
    if (Array.isArray(refs) && refs.length > 0) {
      throw new Error("validation.supplierHasPurchases");
    }
    await db.execute("DELETE FROM suppliers WHERE id = $1", [id]);
    await appendAuditLog(db, {
      action: "supplier.deleted",
      actorUserId: operatorId,
      entity: "supplier",
      entityId: id,
    });
  });
}
