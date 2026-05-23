"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useI18n } from "@/i18n/hooks";
import { isMudirDesktop } from "@/lib/runtime";
import { translateError } from "@/lib/translate-error";

const CHART_HEIGHT = 220;

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-1)",
];

export function DashboardCharts() {
  const { t } = useI18n();
  const salesTitleId = useId();
  const expensesTitleId = useId();
  const [mounted, setMounted] = useState(false);
  const [salesSeries, setSalesSeries] = useState<SalesDayPoint[]>([]);
  const [expenses, setExpenses] = useState<ExpenseCategoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const salesChartConfig = useMemo(
    () =>
      ({
        total: {
          color: "var(--chart-1)",
          label: t("common.total"),
        },
      }) satisfies ChartConfig,
    [t]
  );

  const expenseChartConfig = useMemo(
    () =>
      ({
        category1: {
          color: "var(--chart-1)",
          label: t("dashboard.charts.expenses"),
        },
        category2: { color: "var(--chart-2)" },
        category3: { color: "var(--chart-3)" },
        category4: { color: "var(--chart-4)" },
        category5: { color: "var(--chart-5)" },
        value: { label: t("common.total") },
      }) satisfies ChartConfig,
    [t]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

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
      const message = err instanceof Error ? err.message : String(err);
      setError(translateError(t, message));
    }
  }, [t]);

  useEffect(() => {
    load().catch(() => undefined);
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
    <section aria-label={t("dashboard.title")} className="mt-10 space-y-8">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle id={salesTitleId}>
            {t("dashboard.charts.salesTrend")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="min-h-[220px] w-full"
            config={salesChartConfig}
            style={{ height: CHART_HEIGHT }}
          >
            {mounted ? (
              <BarChart
                data={salesChartData}
                margin={{ bottom: 0, left: 0, right: 8, top: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  width={40}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [
                        typeof value === "number"
                          ? value.toFixed(2)
                          : String(value ?? ""),
                        t("common.total"),
                      ]}
                    />
                  }
                />
                <Bar
                  dataKey="total"
                  fill="var(--color-total)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            ) : null}
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle id={expensesTitleId}>
            {t("dashboard.charts.expenses")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenseChartData.length === 0 ? (
            <p className="mt-4 text-muted-foreground text-sm">
              {t("dashboard.charts.noData")}
            </p>
          ) : (
            <ChartContainer
              className="min-h-[220px] w-full"
              config={expenseChartConfig}
              style={{ height: CHART_HEIGHT }}
            >
              {mounted ? (
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={expenseChartData}
                    dataKey="value"
                    innerRadius={44}
                    label={({ name, percent }) =>
                      `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                    nameKey="name"
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {expenseChartData.map((row, i) => (
                      <Cell
                        fill={
                          PIE_COLORS[i % PIE_COLORS.length] ?? "var(--chart-1)"
                        }
                        key={row.name}
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
              ) : null}
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {isMudirDesktop() ? (
        <Button
          onClick={() => {
            load().catch(() => undefined);
          }}
          type="button"
          variant="outline"
        >
          {t("common.refresh")}
        </Button>
      ) : (
        <Alert>
          <AlertDescription>{t("common.db.tauriOnly")}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
