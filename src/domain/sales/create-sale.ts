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
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

export const createSaleSchema = z.object({
  cashierId: z.string().min(1),
  customerId: z.string().min(1).optional(),
  discountAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
  items: z.array(saleItemSchema).min(1),
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
  raw: CreateSaleInput,
): { ok: true; sale: SaleRecord } | { ok: false; error: string } {
  const parsed = createSaleSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  const input = parsed.data;

  const subtotal = input.items.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  );
  const total = Math.max(0, subtotal - input.discountAmount + input.taxAmount);
  if (input.paidAmount < total) {
    return { ok: false, error: "paidAmount is less than total" };
  }

  const backup = cloneMutableSaleStore(store);

  const saleId = newId("sale");
  const createdAt = nowIso();
  const sale: SaleRecord = {
    id: saleId,
    cashierId: input.cashierId,
    customerId: input.customerId,
    subtotal,
    discountAmount: input.discountAmount,
    taxAmount: input.taxAmount,
    totalAmount: total,
    paidAmount: input.paidAmount,
    changeAmount: input.paidAmount - total,
    createdAt,
  };

  const lines: SaleLineRecord[] = [];

  for (const line of input.items) {
    const product = store.products.get(line.productId);
    if (!product) {
      restoreMutableSaleStore(store, backup);
      return { ok: false, error: `unknown product: ${line.productId}` };
    }
    if (product.onHandQty < line.quantity) {
      restoreMutableSaleStore(store, backup);
      return {
        ok: false,
        error: `insufficient stock for ${line.productId}: need ${line.quantity}, have ${product.onHandQty}`,
      };
    }
    product.onHandQty -= line.quantity;
    lines.push({
      saleId,
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    });
    const movement: StockMovementRecord = {
      id: newId("mov"),
      productId: line.productId,
      type: "sale",
      quantityDelta: -line.quantity,
      refId: saleId,
      createdAt,
    };
    store.stockMovements.push(movement);
  }

  const payment: PaymentRecord = {
    id: newId("pay"),
    saleId,
    amount: input.paidAmount,
    createdAt,
  };
  const audit: AuditLogRecord = {
    id: newId("aud"),
    actorUserId: input.cashierId,
    action: "sale.created",
    entity: "sale",
    entityId: saleId,
    payload: JSON.stringify({ total, lines: lines.length }),
    createdAt,
  };

  store.sales.push(sale);
  store.saleItems.set(saleId, lines);
  store.payments.push(payment);
  store.auditLogs.push(audit);

  return { ok: true, sale };
}
