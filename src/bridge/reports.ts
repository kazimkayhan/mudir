import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import {
  type ChannelTotals,
  computePlLite,
  type PlLiteSummary,
  rollupSalesByChannel,
  rollupSalesByDay,
  salesMapToChartSeries,
} from "@/domain/reports/rollup";
import { loadAppDatabase } from "@/lib/app-db";

const saleRollupRowSchema = z.object({
  channel: z.string().optional(),
  created_at: z.string(),
  returned_at: z.string().nullable(),
  total_amount: z.coerce.number(),
});

const saleChannelRowSchema = z.object({
  channel: z.string().optional(),
  returned_at: z.string().nullable(),
  total_amount: z.coerce.number(),
});

export interface SalesDayPoint {
  day: string;
  total: number;
}
export interface ExpenseCategoryPoint {
  category: string;
  total: number;
}
export interface TopProductPoint {
  name: string;
  productId: string;
  quantity: number;
  revenue: number;
}

/** سری فروش روزانه برای Recharts (فروش‌های برگشت‌خورده حذف می‌شوند). */
export async function fetchSalesDailySeries(
  dayCount: number
): Promise<SalesDayPoint[]> {
  if (!isTauri() || dayCount < 1) {
    return salesMapToChartSeries(new Map(), Math.max(1, dayCount));
  }
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - dayCount - 1);
  const sinceIso = since.toISOString();
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT created_at, total_amount, returned_at FROM sales WHERE created_at >= $1",
    [sinceIso]
  );
  const rows = z.array(saleRollupRowSchema).parse(raw);
  const map = rollupSalesByDay(rows);
  return salesMapToChartSeries(map, dayCount);
}

export async function fetchExpenseTotalsByCategory(): Promise<
  ExpenseCategoryPoint[]
> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT category, SUM(amount) as total FROM expenses GROUP BY category ORDER BY total DESC"
  );
  return z
    .array(
      z.object({
        category: z.string(),
        total: z.coerce.number(),
      })
    )
    .parse(raw);
}

export async function fetchChannelTotals(days = 30): Promise<ChannelTotals> {
  if (!isTauri()) {
    return { inStore: 0, net: 0, online: 0, returns: 0 };
  }
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT channel, total_amount, returned_at FROM sales WHERE created_at >= $1",
    [since.toISOString()]
  );
  const rows = z.array(saleChannelRowSchema).parse(raw);
  return rollupSalesByChannel(
    rows.map((r) => ({
      channel: r.channel ?? "in_store",
      returned_at: r.returned_at,
      total_amount: r.total_amount,
    }))
  );
}

export async function fetchTopProducts(limit = 10): Promise<TopProductPoint[]> {
  if (!isTauri()) {
    return [];
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    `SELECT si.product_id as product_id, p.name as name,
      SUM(si.quantity) as quantity, SUM(si.quantity * si.unit_price) as revenue
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     JOIN sales s ON s.id = si.sale_id
     WHERE s.returned_at IS NULL
     GROUP BY si.product_id
     ORDER BY revenue DESC
     LIMIT $1`,
    [limit]
  );
  return z
    .array(
      z.object({
        name: z.string(),
        product_id: z.string(),
        quantity: z.coerce.number(),
        revenue: z.coerce.number(),
      })
    )
    .parse(raw)
    .map((row) => ({
      name: row.name,
      productId: row.product_id,
      quantity: row.quantity,
      revenue: row.revenue,
    }));
}

export async function fetchStockValuation(): Promise<number> {
  if (!isTauri()) {
    return 0;
  }
  const db = await loadAppDatabase();
  const raw = await db.select<unknown>(
    "SELECT COALESCE(SUM(on_hand_qty * cost_price), 0) as total FROM products WHERE is_active = 1"
  );
  const rows = z.array(z.object({ total: z.coerce.number() })).parse(raw);
  return rows[0]?.total ?? 0;
}

export async function fetchPlSummary(days = 30): Promise<PlLiteSummary> {
  if (!isTauri()) {
    return computePlLite(0, 0, 0);
  }
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString();
  const db = await loadAppDatabase();
  const [revenueRaw, cogsRaw, expenseRaw] = await Promise.all([
    db.select<unknown>(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE returned_at IS NULL AND created_at >= $1",
      [sinceIso]
    ),
    db.select<unknown>(
      `SELECT COALESCE(SUM(pl.quantity * pl.unit_cost), 0) as total
       FROM purchase_lines pl
       JOIN purchases p ON p.id = pl.purchase_id
       WHERE p.created_at >= $1`,
      [sinceIso]
    ),
    db.select<unknown>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE created_at >= $1",
      [sinceIso]
    ),
  ]);
  const totalRows = z.array(z.object({ total: z.coerce.number() }));
  return computePlLite(
    totalRows.parse(revenueRaw)[0]?.total ?? 0,
    totalRows.parse(cogsRaw)[0]?.total ?? 0,
    totalRows.parse(expenseRaw)[0]?.total ?? 0
  );
}

export function salesCsvWithBom(rows: SalesDayPoint[]): string {
  const header = "\uFEFFday,total\n";
  const body = rows.map((r) => `${r.day},${r.total}`).join("\n");
  return header + body;
}
