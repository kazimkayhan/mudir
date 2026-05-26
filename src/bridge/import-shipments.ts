import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { requireOperatorId } from "@/bridge/users";
import { loadAppDatabase } from "@/lib/app-db";
import { appendAuditLog } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";

const shipmentRowSchema = z.object({
  arrival_date: z.string().nullable(),
  clearance_fees: z.coerce.number(),
  created_at: z.string(),
  currency_code: z.string(),
  customs_declaration_no: z.string().nullable(),
  customs_duty: z.coerce.number(),
  exchange_rate: z.coerce.number(),
  foreign_invoice_ref: z.string().nullable(),
  freight_cost: z.coerce.number(),
  id: z.string(),
  insurance_cost: z.coerce.number(),
  notes: z.string().nullable(),
  origin_country: z.string().nullable(),
  other_costs: z.coerce.number(),
  reference: z.string(),
  status: z.string(),
  supplier_id: z.string().nullable(),
  supplier_name: z.string().nullable().optional(),
  updated_at: z.string(),
});

export type ImportShipmentRow = z.infer<typeof shipmentRowSchema>;

const SHIPMENT_SELECT = `SELECT s.id, s.reference, s.supplier_id, sup.name AS supplier_name, s.foreign_invoice_ref,
  s.origin_country, s.arrival_date, s.customs_declaration_no, s.status, s.freight_cost, s.insurance_cost,
  s.customs_duty, s.clearance_fees, s.other_costs, s.currency_code, s.exchange_rate, s.notes, s.created_at, s.updated_at
  FROM import_shipments s LEFT JOIN suppliers sup ON sup.id = s.supplier_id`;

export async function listImportShipments(): Promise<ImportShipmentRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `${SHIPMENT_SELECT} ORDER BY s.created_at DESC`
  );
  return z.array(shipmentRowSchema).parse(raw);
}

export async function insertImportShipment(input: {
  customsDeclarationNo?: string;
  foreignInvoiceRef?: string;
  originCountry?: string;
  reference: string;
  supplierId?: string;
}): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const operatorId = await requireOperatorId();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await runInTransaction(async (db) => {
    await db.execute(
      `INSERT INTO import_shipments (id, reference, supplier_id, foreign_invoice_ref, origin_country, customs_declaration_no,
        status, freight_cost, insurance_cost, customs_duty, clearance_fees, other_costs, currency_code, exchange_rate, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'in_transit', 0, 0, 0, 0, 0, 'USD', 1, NULL, $7, $7)`,
      [
        id,
        input.reference.trim(),
        input.supplierId ?? null,
        input.foreignInvoiceRef ?? null,
        input.originCountry ?? null,
        input.customsDeclarationNo ?? null,
        now,
      ]
    );
    await appendAuditLog(db, {
      action: "import_shipment.created",
      actorUserId: operatorId,
      entity: "import_shipment",
      entityId: id,
    });
  });
  return { id };
}

export function shipmentTotalCosts(row: ImportShipmentRow): number {
  return (
    row.freight_cost +
    row.insurance_cost +
    row.customs_duty +
    row.clearance_fees +
    row.other_costs
  );
}

export async function updateImportShipmentCosts(
  id: string,
  costs: Partial<{
    clearanceFees: number;
    customsDuty: number;
    freightCost: number;
    insuranceCost: number;
    otherCosts: number;
    status: string;
  }>
): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const now = new Date().toISOString();
  const db = await loadAppDatabase();
  await db.execute(
    `UPDATE import_shipments SET freight_cost = COALESCE($1, freight_cost), insurance_cost = COALESCE($2, insurance_cost),
      customs_duty = COALESCE($3, customs_duty), clearance_fees = COALESCE($4, clearance_fees),
      other_costs = COALESCE($5, other_costs), status = COALESCE($6, status), updated_at = $7 WHERE id = $8`,
    [
      costs.freightCost ?? null,
      costs.insuranceCost ?? null,
      costs.customsDuty ?? null,
      costs.clearanceFees ?? null,
      costs.otherCosts ?? null,
      costs.status ?? null,
      now,
      id,
    ]
  );
}
