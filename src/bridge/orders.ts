import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { completePosSale } from "@/bridge/sales";
import { getBusinessSettings } from "@/bridge/settings";
import { requireOperatorId } from "@/bridge/users";
import { loadAppDatabase } from "@/lib/app-db";
import { appendAuditLog } from "@/lib/audit-log";
import { runInTransaction } from "@/lib/run-in-transaction";

export const orderSources = ["phone", "whatsapp", "web", "other"] as const;
export type OrderSource = (typeof orderSources)[number];
export type OrderStatus = "pending" | "confirmed" | "completed" | "cancelled";

const orderRowSchema = z.object({
  created_at: z.string(),
  currency_code: z.string(),
  customer_id: z.string(),
  customer_name: z.string().nullable().optional(),
  delivery_note: z.string().nullable(),
  exchange_rate: z.coerce.number(),
  external_ref: z.string().nullable(),
  id: z.string(),
  operator_id: z.string(),
  sale_id: z.string().nullable(),
  source: z.string(),
  status: z.string(),
  subtotal: z.coerce.number(),
  total_amount: z.coerce.number(),
  updated_at: z.string(),
});

export type OnlineOrderRow = z.infer<typeof orderRowSchema>;

const orderItemSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  product_id: z.string(),
  product_name: z.string().nullable().optional(),
  quantity: z.coerce.number(),
  unit_price: z.coerce.number(),
});

export async function listOnlineOrders(
  status?: OrderStatus,
  limit = 100
): Promise<OnlineOrderRow[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const sql = status
    ? `SELECT o.id, o.customer_id, c.name AS customer_name, o.source, o.status, o.delivery_note, o.currency_code, o.exchange_rate, o.operator_id, o.external_ref, o.sale_id, o.subtotal, o.total_amount, o.created_at, o.updated_at
       FROM online_orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.status = $1 ORDER BY o.created_at DESC LIMIT $2`
    : `SELECT o.id, o.customer_id, c.name AS customer_name, o.source, o.status, o.delivery_note, o.currency_code, o.exchange_rate, o.operator_id, o.external_ref, o.sale_id, o.subtotal, o.total_amount, o.created_at, o.updated_at
       FROM online_orders o LEFT JOIN customers c ON c.id = o.customer_id ORDER BY o.created_at DESC LIMIT $1`;
  const raw = status
    ? await db.select<unknown>(sql, [status, limit])
    : await db.select<unknown>(sql, [limit]);
  return z.array(orderRowSchema).parse(raw);
}

export async function getOnlineOrderDetail(orderId: string): Promise<{
  order: OnlineOrderRow;
  items: z.infer<typeof orderItemSchema>[];
} | null> {
  if (!isTauri()) {
    return null;
  }
  const db = await loadAppDatabase();
  const orderRaw = await db.select<unknown>(
    `SELECT o.id, o.customer_id, c.name AS customer_name, o.source, o.status, o.delivery_note, o.currency_code, o.exchange_rate, o.operator_id, o.external_ref, o.sale_id, o.subtotal, o.total_amount, o.created_at, o.updated_at
     FROM online_orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`,
    [orderId]
  );
  const orders = z.array(orderRowSchema).parse(orderRaw);
  const order = orders[0];
  if (!order) {
    return null;
  }
  const itemsRaw = await db.select<unknown>(
    `SELECT oi.id, oi.order_id, oi.product_id, p.name AS product_name, oi.quantity, oi.unit_price
     FROM online_order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`,
    [orderId]
  );
  const items = z.array(orderItemSchema).parse(itemsRaw);
  return { items, order };
}

export async function createOnlineOrder(raw: {
  customerId: string;
  source: OrderSource;
  deliveryNote?: string;
  externalRef?: string;
  currencyCode?: "AFN" | "USD";
  items: { productId: string; quantity: number; unitPrice: number }[];
}): Promise<{ id: string }> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  if (raw.items.length === 0) {
    throw new Error("Order must have items");
  }
  const operatorId = await requireOperatorId();
  const settings = await getBusinessSettings();
  const currencyCode = raw.currencyCode ?? settings.baseCurrency;
  const exchangeRate = currencyCode === "USD" ? settings.usdToAfnRate : 1;
  const subtotal = raw.items.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await runInTransaction(async (db) => {
    await db.execute(
      `INSERT INTO online_orders (id, customer_id, source, status, delivery_note, currency_code, exchange_rate, operator_id, external_ref, sale_id, subtotal, total_amount, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, NULL, $9, $10, $11, $12)`,
      [
        id,
        raw.customerId,
        raw.source,
        raw.deliveryNote ?? null,
        currencyCode,
        exchangeRate,
        operatorId,
        raw.externalRef ?? null,
        subtotal,
        subtotal,
        now,
        now,
      ]
    );
    for (const line of raw.items) {
      await db.execute(
        "INSERT INTO online_order_items (id, order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)",
        [crypto.randomUUID(), id, line.productId, line.quantity, line.unitPrice]
      );
    }
    await appendAuditLog(db, {
      action: "order.created",
      actorUserId: operatorId,
      entity: "online_order",
      entityId: id,
    });
  });
  return { id };
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const operatorId = await requireOperatorId();
  const now = new Date().toISOString();
  await runInTransaction(async (db) => {
    await db.execute(
      "UPDATE online_orders SET status = $1, updated_at = $2 WHERE id = $3",
      [status, now, orderId]
    );
    await appendAuditLog(db, {
      action: "order.status_updated",
      actorUserId: operatorId,
      entity: "online_order",
      entityId: orderId,
      payload: JSON.stringify({ status }),
    });
  });
}

export async function fulfillOnlineOrder(orderId: string): Promise<{
  saleId: string;
}> {
  if (!isTauri()) {
    throw new Error("common.db.tauriOnly");
  }
  const detail = await getOnlineOrderDetail(orderId);
  if (!detail) {
    throw new Error("Order not found");
  }
  if (detail.order.status === "completed") {
    throw new Error("Order already completed");
  }
  if (detail.order.status === "cancelled") {
    throw new Error("Order cancelled");
  }

  const { saleId } = await completePosSale(
    {
      cashierId: detail.order.operator_id,
      customerId: detail.order.customer_id,
      discountAmount: 0,
      items: detail.items.map((i) => ({
        productId: i.product_id,
        quantity: i.quantity,
        unitPrice: i.unit_price,
      })),
      paidAmount: detail.order.total_amount,
      taxAmount: 0,
    },
    {
      channel: "online",
      currencyCode: detail.order.currency_code as "AFN" | "USD",
      exchangeRate: detail.order.exchange_rate,
      orderId,
      payments: [
        {
          amount: detail.order.total_amount,
          currencyCode: detail.order.currency_code,
          method: "cash",
        },
      ],
    }
  );

  const operatorId = await requireOperatorId();
  const now = new Date().toISOString();
  await runInTransaction(async (db) => {
    await db.execute(
      "UPDATE online_orders SET status = 'completed', sale_id = $1, updated_at = $2 WHERE id = $3",
      [saleId, now, orderId]
    );
    await appendAuditLog(db, {
      action: "order.fulfilled",
      actorUserId: operatorId,
      entity: "online_order",
      entityId: orderId,
      payload: JSON.stringify({ saleId }),
    });
  });

  return { saleId };
}
