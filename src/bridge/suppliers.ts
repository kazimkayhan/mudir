import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { requireOperatorId } from "@/bridge/users";
import {
  type SupplierWriteInput,
  supplierWriteSchema,
} from "@/domain/finance/schemas";
import { loadAppDatabase } from "@/lib/app-db";
import { appendAuditLog } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";

const supplierRowSchema = z.object({
  address: z.string().nullable(),
  bank_details: z.string().nullable(),
  country: z.string().nullable(),
  created_at: z.string(),
  currency: z.string().nullable(),
  email: z.string().nullable(),
  id: z.string(),
  lead_time_days: z.coerce.number().nullable(),
  name: z.string(),
  phone: z.string().nullable(),
});

export type SupplierRow = z.infer<typeof supplierRowSchema>;

const SUPPLIER_SELECT =
  "SELECT id, name, phone, country, currency, email, address, lead_time_days, bank_details, created_at FROM suppliers";

function normalizeSupplierInput(input: SupplierWriteInput) {
  return {
    address: input.address?.trim() || null,
    bank_details: input.bankDetails?.trim() || null,
    country: input.country?.trim() || null,
    currency: input.currency ?? "USD",
    email: input.email?.trim() || null,
    lead_time_days: input.leadTimeDays ?? null,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
  };
}

export async function listSuppliers(): Promise<SupplierRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `${SUPPLIER_SELECT} ORDER BY name COLLATE NOCASE`
  );
  return z.array(supplierRowSchema).parse(raw);
}

export async function insertSupplier(raw: unknown): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = supplierWriteSchema.parse(raw);
  const values = normalizeSupplierInput(input);
  const operatorId = await requireOperatorId();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await runInTransaction(async (db) => {
    await db.execute(
      `INSERT INTO suppliers (
        id, name, phone, country, currency, email, address, lead_time_days, bank_details, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        values.name,
        values.phone,
        values.country,
        values.currency,
        values.email,
        values.address,
        values.lead_time_days,
        values.bank_details,
        now,
      ]
    );
    await appendAuditLog(db, {
      action: "supplier.created",
      actorUserId: operatorId,
      entity: "supplier",
      entityId: id,
      payload: JSON.stringify({ name: values.name }),
    });
  });
  return { id };
}

export async function updateSupplier(
  raw: SupplierWriteInput & { id: string }
): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const input = supplierWriteSchema.parse(raw);
  const values = normalizeSupplierInput(input);
  const operatorId = await requireOperatorId();
  await runInTransaction(async (db) => {
    await db.execute(
      `UPDATE suppliers SET
        name = $1,
        phone = $2,
        country = $3,
        currency = $4,
        email = $5,
        address = $6,
        lead_time_days = $7,
        bank_details = $8
      WHERE id = $9`,
      [
        values.name,
        values.phone,
        values.country,
        values.currency,
        values.email,
        values.address,
        values.lead_time_days,
        values.bank_details,
        raw.id,
      ]
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
    const purchaseRefs = await db.select<unknown>(
      "SELECT 1 FROM purchases WHERE supplier_id = $1 LIMIT 1",
      [id]
    );
    const shipmentRefs = await db.select<unknown>(
      "SELECT 1 FROM import_shipments WHERE supplier_id = $1 LIMIT 1",
      [id]
    );
    if (
      (Array.isArray(purchaseRefs) && purchaseRefs.length > 0) ||
      (Array.isArray(shipmentRefs) && shipmentRefs.length > 0)
    ) {
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
