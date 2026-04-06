import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { supplierWriteSchema } from "@/domain/finance/schemas";
import { loadAppDatabase } from "@/lib/app-db";
import { DEFAULT_AUDIT_ACTOR_ID, logAuditEvent } from "@/lib/audit-log";

const supplierRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  created_at: z.string(),
});

export type SupplierRow = z.infer<typeof supplierRowSchema>;

export async function listSuppliers(): Promise<SupplierRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT id, name, phone, created_at FROM suppliers ORDER BY name COLLATE NOCASE",
  );
  return z.array(supplierRowSchema).parse(raw);
}

export async function insertSupplier(raw: unknown): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("Database is only available inside the Tauri app.");
  }
  const input = supplierWriteSchema.parse(raw);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = await loadAppDatabase();
  await db.execute(
    "INSERT INTO suppliers (id, name, phone, created_at) VALUES ($1, $2, $3, $4)",
    [id, input.name, input.phone ?? null, now],
  );
  await logAuditEvent({
    actorUserId: DEFAULT_AUDIT_ACTOR_ID,
    action: "supplier.created",
    entity: "supplier",
    entityId: id,
    payload: JSON.stringify({ name: input.name }),
  });
  return { id };
}
