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

const H = 260;
const PIE_COLORS = [
  "#404040",
  "#737373",
  "#a3a3a3",
  "#d4d4d4",
  "#171717",
  "#525252",
];

function downloadSalesCsv(rows: SalesDayPoint[]) {
  const header = "day,total\n";
  const body = rows.map((r) => `${r.day},${r.total}`).join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mudir-sales-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsClient() {
  const salesTitleId = useId();
  const expTitleId = useId();
  const [days] = useState(30);
  const [sales, setSales] = useState<SalesDayPoint[]>([]);
  const [expenses, setExpenses] = useState<ExpenseCategoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, e] = await Promise.all([
        fetchSalesDailySeries(days),
        fetchExpenseTotalsByCategory(),
      ]);
      setSales(s);
      setExpenses(e);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const salesData = sales.map((p) => ({ ...p, label: p.day.slice(5) }));
  const expenseData = expenses.map((p) => ({
    name: p.category,
    value: Math.round(p.total * 100) / 100,
  }));

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="font-semibold text-2xl tracking-tight">Reports</h1>
      <p className="mt-1 text-neutral-600 text-sm dark:text-neutral-400">
        Recharts views and a CSV export of the daily sales series (source
        tables, no UI-only state).
      </p>

      {error ? (
        <p className="mt-4 text-red-600 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
          onClick={() => {
            void load();
          }}
        >
          Refresh
        </button>
        <button
          type="button"
          disabled={sales.length === 0}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          onClick={() => {
            downloadSalesCsv(sales);
          }}
        >
          Download sales CSV
        </button>
      </div>

      {!isTauri() ? (
        <p className="mt-4 text-amber-800 text-sm dark:text-amber-200">
          Data loads from SQLite in Tauri; browser preview shows empty series.
        </p>
      ) : null}

      <section className="mt-10" aria-labelledby={salesTitleId}>
        <h2 className="font-medium text-lg" id={salesTitleId}>
          Sales by day ({days} days)
        </h2>
        <div
          className="mt-3 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800"
          style={{ height: H }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={salesData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-neutral-200 dark:stroke-neutral-800"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} width={44} />
              <Tooltip
                formatter={(v) => [
                  typeof v === "number" ? v.toFixed(2) : String(v ?? ""),
                  "Total",
                ]}
              />
              <Bar
                dataKey="total"
                fill="#262626"
                radius={[4, 4, 0, 0]}
                className="dark:fill-neutral-200"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-10" aria-labelledby={expTitleId}>
        <h2 className="font-medium text-lg" id={expTitleId}>
          Expenses by category
        </h2>
        {expenseData.length === 0 ? (
          <p className="mt-3 text-neutral-500 text-sm">No expenses recorded.</p>
        ) : (
          <div
            className="mt-3 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800"
            style={{ height: H }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={88}
                  label={({ name, percent }) =>
                    `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                >
                  {expenseData.map((row, i) => (
                    <Cell
                      key={row.name}
                      fill={PIE_COLORS[i % PIE_COLORS.length] ?? "#737373"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) =>
                    typeof v === "number" ? v.toFixed(2) : String(v ?? "")
                  }
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </main>
  );
}
