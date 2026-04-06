import { z } from "zod";
import {
  cloneMutableSaleStore,
  restoreMutableSaleStore,
} from "@/domain/sales/mutable-store-utils";
import type {
  AuditLogRecord,
  MutableSaleStore,
  StockMovementRecord,
} from "@/domain/types";

export const returnSaleSchema = z.object({
  originalSaleId: z.string().min(1, "Sale id is required"),
  cashierId: z.string().min(1, "Cashier is required"),
});

export type ReturnSaleInput = z.infer<typeof returnSaleSchema>;

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * برگشت کامل یک فروش: موجودی برمی‌گردد، حرکت نوع `return` ثبت می‌شود،
 * `returnedAt` روی فروش ست می‌شود — یا کل state به snapshot برمی‌گردد.
 */
export function returnSaleAtomic(
  store: MutableSaleStore,
  raw: unknown,
): { ok: true } | { ok: false; error: string } {
  const parsed = returnSaleSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  const input = parsed.data;

  const backup = cloneMutableSaleStore(store);
  const sale = store.sales.find((s) => s.id === input.originalSaleId);
  if (!sale) {
    return { ok: false, error: "Sale not found" };
  }
  if (sale.returnedAt) {
    return { ok: false, error: "Sale already returned" };
  }
  const lines = store.saleItems.get(sale.id);
  if (!lines?.length) {
    return { ok: false, error: "Sale has no lines" };
  }

  const createdAt = nowIso();

  for (const line of lines) {
    const product = store.products.get(line.productId);
    if (!product) {
      restoreMutableSaleStore(store, backup);
      return { ok: false, error: `unknown product: ${line.productId}` };
    }
    product.onHandQty += line.quantity;
    const movement: StockMovementRecord = {
      id: newId("mov"),
      productId: line.productId,
      type: "return",
      quantityDelta: line.quantity,
      refId: `return:${sale.id}`,
      createdAt,
    };
    store.stockMovements.push(movement);
  }

  sale.returnedAt = createdAt;

  const audit: AuditLogRecord = {
    id: newId("aud"),
    actorUserId: input.cashierId,
    action: "sale.returned",
    entity: "sale",
    entityId: sale.id,
    payload: JSON.stringify({ lines: lines.length }),
    createdAt,
  };
  store.auditLogs.push(audit);

  return { ok: true };
}
