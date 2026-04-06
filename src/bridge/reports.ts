import { isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import {
  rollupSalesByDay,
  salesMapToChartSeries,
} from "@/domain/reports/rollup";
import { loadAppDatabase } from "@/lib/app-db";

const saleRollupRowSchema = z.object({
  created_at: z.string(),
  total_amount: z.coerce.number(),
  returned_at: z.string().nullable(),
});

export type SalesDayPoint = { day: string; total: number };
export type ExpenseCategoryPoint = { category: string; total: number };

/** سری فروش روزانه برای Recharts (فروش‌های برگشت‌خورده حذف می‌شوند). */
export async function fetchSalesDailySeries(
  dayCount: number,
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
    [sinceIso],
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
    "SELECT category, SUM(amount) as total FROM expenses GROUP BY category ORDER BY total DESC",
  );
  return z
    .array(
      z.object({
        category: z.string(),
        total: z.coerce.number(),
      }),
    )
    .parse(raw);
}
