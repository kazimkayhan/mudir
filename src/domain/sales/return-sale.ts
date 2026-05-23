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
  cashierId: z.string().min(1, "validation.cashierRequired").optional(),
  originalSaleId: z.string().min(1, "validation.saleIdRequired"),
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
  raw: unknown
): { ok: true } | { ok: false; error: string } {
  const parsed = returnSaleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.message, ok: false };
  }
  const input = parsed.data;
  const cashierId = input.cashierId;
  if (!cashierId) {
    return { error: "validation.cashierRequired", ok: false };
  }

  const backup = cloneMutableSaleStore(store);
  const sale = store.sales.find((s) => s.id === input.originalSaleId);
  if (!sale) {
    return { error: "validation.saleNotFound", ok: false };
  }
  if (sale.returnedAt) {
    return { error: "validation.saleAlreadyReturned", ok: false };
  }
  const lines = store.saleItems.get(sale.id);
  if (!lines?.length) {
    return { error: "validation.internalError", ok: false };
  }

  const createdAt = nowIso();

  for (const line of lines) {
    const product = store.products.get(line.productId);
    if (!product) {
      restoreMutableSaleStore(store, backup);
      return { error: "validation.productRequired", ok: false };
    }
    product.onHandQty += line.quantity;
    const movement: StockMovementRecord = {
      createdAt,
      id: newId("mov"),
      productId: line.productId,
      quantityDelta: line.quantity,
      refId: `return:${sale.id}`,
      type: "return",
    };
    store.stockMovements.push(movement);
  }

  sale.returnedAt = createdAt;

  const audit: AuditLogRecord = {
    action: "sale.returned",
    actorUserId: cashierId,
    createdAt,
    entity: "sale",
    entityId: sale.id,
    id: newId("aud"),
    payload: JSON.stringify({ lines: lines.length }),
  };
  store.auditLogs.push(audit);

  return { ok: true };
}
