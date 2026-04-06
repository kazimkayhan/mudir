"use client";

import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useId, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ExpenseCategoryPoint,
  fetchExpenseTotalsByCategory,
  fetchSalesDailySeries,
  type SalesDayPoint,
} from "@/bridge/reports";

const CHART_HEIGHT = 220;
const PIE_COLORS = [
  "#404040",
  "#737373",
  "#a3a3a3",
  "#d4d4d4",
  "#171717",
  "#525252",
];

export function DashboardCharts() {
  const salesTitleId = useId();
  const expensesTitleId = useId();
  const [salesSeries, setSalesSeries] = useState<SalesDayPoint[]>([]);
  const [expenses, setExpenses] = useState<ExpenseCategoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, e] = await Promise.all([
        fetchSalesDailySeries(14),
        fetchExpenseTotalsByCategory(),
      ]);
      setSalesSeries(s);
      setExpenses(e);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const salesChartData = salesSeries.map((p) => ({
    ...p,
    label: p.day.slice(5),
  }));

  const expenseChartData = expenses.map((p) => ({
    name: p.category,
    value: Math.round(p.total * 100) / 100,
  }));

  return (
    <section className="mt-10 space-y-8" aria-label="Charts">
      {error ? (
        <p className="text-red-600 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <h2 className="font-medium text-lg" id={salesTitleId}>
          Sales (last 14 days, excl. returns)
        </h2>
        <p className="mt-1 text-neutral-600 text-xs dark:text-neutral-400">
          From{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
            sales
          </code>{" "}
          table — empty until you record POS sales in Tauri.
        </p>
        <div
          className="mt-3 w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800"
          style={{ height: CHART_HEIGHT }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={salesChartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-neutral-200 dark:stroke-neutral-800"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                className="text-neutral-500"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                width={40}
                className="text-neutral-500"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--color-neutral-200)",
                  fontSize: 12,
                }}
                formatter={(value) => [
                  typeof value === "number"
                    ? value.toFixed(2)
                    : String(value ?? ""),
                  "Total",
                ]}
              />
              <Bar
                dataKey="total"
                fill="var(--color-neutral-800)"
                radius={[4, 4, 0, 0]}
                className="dark:fill-neutral-200"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h2 className="font-medium text-lg" id={expensesTitleId}>
          Expenses by category
        </h2>
        <p className="mt-1 text-neutral-600 text-xs dark:text-neutral-400">
          Add expenses under Finance. Pie shows share of recorded totals.
        </p>
        {expenseChartData.length === 0 ? (
          <p className="mt-4 text-neutral-500 text-sm">No expenses yet.</p>
        ) : (
          <div
            className="mt-3 w-full rounded-lg border border-neutral-200 p-2 dark:border-neutral-800"
            style={{ height: CHART_HEIGHT }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={72}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                >
                  {expenseChartData.map((row, i) => (
                    <Cell
                      key={row.name}
                      fill={PIE_COLORS[i % PIE_COLORS.length] ?? "#737373"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number"
                      ? value.toFixed(2)
                      : String(value ?? "")
                  }
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {!isTauri() ? (
        <p className="text-amber-800 text-sm dark:text-amber-200">
          Charts use live SQLite in Tauri; in the browser preview series stay
          empty.
        </p>
      ) : (
        <button
          type="button"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
          onClick={() => {
            void load();
          }}
        >
          Refresh charts
        </button>
      )}
    </section>
  );
}
