"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { isTauri } from "@tauri-apps/api/core";
import { Download } from "lucide-react";
import Link from "next/link";
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
  fetchChannelTotals,
  fetchExpenseTotalsByCategory,
  fetchPlSummary,
  fetchSalesDailySeries,
  fetchStockValuation,
  fetchTopProducts,
  type SalesDayPoint,
  salesCsvWithBom,
  type TopProductPoint,
} from "@/bridge/reports";
import { PageTitle } from "@/components/app-icons";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChannelTotals, PlLiteSummary } from "@/domain/reports/rollup";
import { useI18n } from "@/i18n/hooks";
import { toastSuccess } from "@/lib/app-toast";
import { formatMoney } from "@/lib/format";

const H = 260;

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-1)",
];

function downloadSalesCsv(rows: SalesDayPoint[]) {
  const blob = new Blob([salesCsvWithBom(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mudir-sales-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsClient() {
  const { t, locale } = useI18n();
  const salesChartConfig = useMemo(
    () =>
      ({
        total: { color: "var(--chart-1)", label: t("common.total") },
      }) satisfies ChartConfig,
    [t]
  );
  const channelChartConfig = useMemo(
    () =>
      ({
        inStore: { color: "var(--chart-1)", label: t("reports.inStore") },
        online: { color: "var(--chart-2)", label: t("reports.online") },
      }) satisfies ChartConfig,
    [t]
  );
  const salesTitleId = useId();
  const channelTitleId = useId();
  const expTitleId = useId();
  const topTitleId = useId();
  const [mounted, setMounted] = useState(false);
  const [days] = useState(30);
  const [sales, setSales] = useState<SalesDayPoint[]>([]);
  const [expenses, setExpenses] = useState<
    { category: string; total: number }[]
  >([]);
  const [channels, setChannels] = useState<ChannelTotals>({
    inStore: 0,
    net: 0,
    online: 0,
    returns: 0,
  });
  const [pl, setPl] = useState<PlLiteSummary>({
    cogs: 0,
    expenses: 0,
    net: 0,
    revenue: 0,
  });
  const [stockValue, setStockValue] = useState(0);
  const [topProducts, setTopProducts] = useState<TopProductPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, e, c, p, stock, top] = await Promise.all([
        fetchSalesDailySeries(days),
        fetchExpenseTotalsByCategory(),
        fetchChannelTotals(days),
        fetchPlSummary(days),
        fetchStockValuation(),
        fetchTopProducts(10),
      ]);
      setSales(s);
      setExpenses(e);
      setChannels(c);
      setPl(p);
      setStockValue(stock);
      setTopProducts(top);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [days]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const salesData = sales.map((p) => ({ ...p, label: p.day.slice(5) }));
  const expenseData = expenses.map((p) => ({
    name: p.category,
    value: Math.round(p.total * 100) / 100,
  }));
  const channelData = [
    {
      fill: "var(--color-inStore)",
      name: t("reports.inStore"),
      value: channels.inStore,
    },
    {
      fill: "var(--color-online)",
      name: t("reports.online"),
      value: channels.online,
    },
  ];

  const topProductColumns = useMemo<ColumnDef<TopProductPoint>[]>(
    () => [
      {
        accessorKey: "name",
        cell: ({ row }) => (
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href="/products"
          >
            {row.original.name}
          </Link>
        ),
        header: t("reports.product"),
      },
      {
        accessorKey: "quantity",
        header: t("purchases.qty"),
      },
      {
        accessorKey: "revenue",
        cell: ({ row }) => formatMoney(row.original.revenue, "AFN", locale),
        header: t("reports.revenue"),
      },
    ],
    [locale, t]
  );

  return (
    <main className="mx-auto max-w-4xl px-6 pb-6">
      <PageHeader>
        <PageTitle href="/reports">{t("reports.title")}</PageTitle>
        <p className="mt-1 text-muted-foreground text-sm">
          {t("reports.inStore")} · {t("reports.online")} · {t("reports.pl")}
        </p>
      </PageHeader>

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            load().catch(() => undefined);
          }}
          type="button"
          variant="outline"
        >
          {t("common.loading")}
        </Button>
        <Button
          data-icon="inline-start"
          disabled={sales.length === 0}
          onClick={() => {
            downloadSalesCsv(sales);
            toastSuccess(t("common.toast.exported"));
          }}
          type="button"
        >
          <Download aria-hidden />
          CSV
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href="/orders">{t("nav.orders")}</Link>
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href="/pos">{t("nav.pos")}</Link>
        </Button>
      </div>

      {isTauri() ? null : (
        <Alert className="mt-4">
          <AlertDescription>{t("common.db.tauriOnly")}</AlertDescription>
        </Alert>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("reports.inStore")}</CardTitle>
          </CardHeader>
          <CardContent>
            {formatMoney(channels.inStore, "AFN", locale)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("reports.online")}</CardTitle>
          </CardHeader>
          <CardContent>
            {formatMoney(channels.online, "AFN", locale)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("reports.stockValue")}
            </CardTitle>
          </CardHeader>
          <CardContent>{formatMoney(stockValue, "AFN", locale)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("reports.pl")}</CardTitle>
          </CardHeader>
          <CardContent>{formatMoney(pl.net, "AFN", locale)}</CardContent>
        </Card>
      </div>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle id={channelTitleId}>
            {t("reports.inStore")} vs {t("reports.online")} ({days}{" "}
            {t("reports.days")})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="min-h-[200px] w-full"
            config={channelChartConfig}
            style={{ height: 200 }}
          >
            {mounted ? (
              <BarChart
                data={channelData}
                layout="vertical"
                margin={{ left: 8 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis axisLine={false} tickLine={false} type="number" />
                <YAxis
                  axisLine={false}
                  dataKey="name"
                  tickLine={false}
                  type="category"
                  width={100}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} />
              </BarChart>
            ) : null}
          </ChartContainer>
          <p className="mt-2 text-muted-foreground text-xs">
            {t("reports.returns")}:{" "}
            {formatMoney(channels.returns, "AFN", locale)} · {t("reports.net")}:{" "}
            {formatMoney(channels.net, "AFN", locale)}
          </p>
        </CardContent>
      </Card>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle id={salesTitleId}>
            {t("reports.dailySales")} ({days} {t("reports.days")})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="min-h-[260px] w-full"
            config={salesChartConfig}
            style={{ height: H }}
          >
            {mounted ? (
              <BarChart
                data={salesData}
                margin={{ bottom: 0, left: 0, right: 12, top: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="label"
                  interval="preserveStartEnd"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  width={44}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(v) => [
                        typeof v === "number"
                          ? formatMoney(v, "AFN", locale)
                          : String(v ?? ""),
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

      <Card className="mt-10">
        <CardHeader>
          <CardTitle>{t("reports.pl")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            {t("reports.revenue")}: {formatMoney(pl.revenue, "AFN", locale)}
          </div>
          <div>
            {t("reports.cogs")}: {formatMoney(pl.cogs, "AFN", locale)}
          </div>
          <div>
            {t("finance.title")}: {formatMoney(pl.expenses, "AFN", locale)}
          </div>
          <div className="font-medium">
            {t("reports.net")}: {formatMoney(pl.net, "AFN", locale)}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle id={topTitleId}>{t("reports.topProducts")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={topProductColumns}
            data={topProducts}
            getSearchText={(row) => row.name}
            showPagination={false}
          />
        </CardContent>
      </Card>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle id={expTitleId}>{t("finance.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {expenseData.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("finance.title")}
            </p>
          ) : (
            <div style={{ height: H }}>
              {mounted ? (
                <PieChart height={H} width={400}>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={expenseData}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                    nameKey="name"
                    outerRadius={88}
                  >
                    {expenseData.map((row, i) => (
                      <Cell
                        fill={
                          PIE_COLORS[i % PIE_COLORS.length] ?? "var(--chart-1)"
                        }
                        key={row.name}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) =>
                      typeof v === "number"
                        ? formatMoney(v, "AFN", locale)
                        : String(v ?? "")
                    }
                  />
                  <Legend />
                </PieChart>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
