import { z } from "zod";
import {
  cloneMutableSaleStore,
  restoreMutableSaleStore,
} from "@/domain/sales/mutable-store-utils";
import type {
  AuditLogRecord,
  CreateSaleInput,
  MutableSaleStore,
  PaymentRecord,
  SaleLineRecord,
  SaleRecord,
  StockMovementRecord,
} from "@/domain/types";

export const saleItemSchema = z.object({
  batchPicks: z
    .array(
      z.object({
        batchId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .optional(),
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

export const createSaleSchema = z.object({
  cashierId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  discountAmount: z.number().nonnegative(),
  items: z.array(saleItemSchema).min(1),
  paidAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
});

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * ثبت فروش به‌صورت اتمیک: یا state نهایی اعمال می‌شود یا به snapshot قبل برمی‌گردد.
 */
export function createSaleAtomic(
  store: MutableSaleStore,
  raw: CreateSaleInput
): { ok: true; sale: SaleRecord } | { ok: false; error: string } {
  const parsed = createSaleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.message, ok: false };
  }
  const input = parsed.data;
  const cashierId = input.cashierId;
  if (!cashierId) {
    return { error: "validation.cashierRequired", ok: false };
  }

  const subtotal = input.items.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0
  );
  const total = Math.max(0, subtotal - input.discountAmount + input.taxAmount);
  if (input.paidAmount < total) {
    return { error: "paidAmount is less than total", ok: false };
  }

  const backup = cloneMutableSaleStore(store);

  const saleId = newId("sale");
  const createdAt = nowIso();
  const sale: SaleRecord = {
    cashierId,
    changeAmount: input.paidAmount - total,
    createdAt,
    customerId: input.customerId,
    discountAmount: input.discountAmount,
    id: saleId,
    paidAmount: input.paidAmount,
    subtotal,
    taxAmount: input.taxAmount,
    totalAmount: total,
  };

  const lines: SaleLineRecord[] = [];

  for (const line of input.items) {
    const product = store.products.get(line.productId);
    if (!product) {
      restoreMutableSaleStore(store, backup);
      return { error: `unknown product: ${line.productId}`, ok: false };
    }
    if (product.onHandQty < line.quantity) {
      restoreMutableSaleStore(store, backup);
      return {
        error: `insufficient stock for ${line.productId}: need ${line.quantity}, have ${product.onHandQty}`,
        ok: false,
      };
    }
    product.onHandQty -= line.quantity;
    lines.push({
      productId: line.productId,
      quantity: line.quantity,
      saleId,
      unitPrice: line.unitPrice,
    });
    const movement: StockMovementRecord = {
      createdAt,
      id: newId("mov"),
      productId: line.productId,
      quantityDelta: -line.quantity,
      refId: saleId,
      type: "sale",
    };
    store.stockMovements.push(movement);
  }

  const payment: PaymentRecord = {
    amount: input.paidAmount,
    createdAt,
    id: newId("pay"),
    saleId,
  };
  const audit: AuditLogRecord = {
    action: "sale.created",
    actorUserId: cashierId,
    createdAt,
    entity: "sale",
    entityId: saleId,
    id: newId("aud"),
    payload: JSON.stringify({ lines: lines.length, total }),
  };

  store.sales.push(sale);
  store.saleItems.set(saleId, lines);
  store.payments.push(payment);
  store.auditLogs.push(audit);

  return { ok: true, sale };
}
