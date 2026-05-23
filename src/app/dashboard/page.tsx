"use client";

import { isTauri } from "@tauri-apps/api/core";
import { ClipboardList, RefreshCw, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getTotalExpensesSince } from "@/bridge/expenses";
import { listLowStockProducts } from "@/bridge/products";
import { getDashboardSalesTotals } from "@/bridge/sales";
import { CardMetricIcon, PageTitle } from "@/components/app-icons";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/hooks";
import { formatMoney } from "@/lib/format";
import { DashboardCharts } from "./dashboard-charts";

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState({
    inStoreToday: 0,
    lowStock: 0,
    monthExpenses: 0,
    onlineToday: 0,
    pendingOrders: 0,
  });

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = `${today.slice(0, 7)}-01T00:00:00.000Z`;
      const [totals, lowStock, monthExpenses] = await Promise.all([
        getDashboardSalesTotals(),
        listLowStockProducts(),
        getTotalExpensesSince(monthStart),
      ]);
      setKpis({
        inStoreToday: totals.inStoreToday,
        lowStock: lowStock.length,
        monthExpenses,
        onlineToday: totals.onlineToday,
        pendingOrders: totals.pendingOrders,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  return (
    <main className="mx-auto max-w-4xl px-6 pb-6">
      <PageHeader>
        <PageTitle href="/dashboard">{t("dashboard.title")}</PageTitle>
      </PageHeader>

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isTauri() ? null : (
        <Alert className="mt-4">
          <AlertDescription>
            <code className="rounded bg-muted px-1">pnpm tauri dev</code>
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CardMetricIcon href="/pos" />
              {t("dashboard.todayInStore")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {formatMoney(kpis.inStoreToday, "AFN", locale)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CardMetricIcon href="/orders" />
              {t("dashboard.todayOnline")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {formatMoney(kpis.onlineToday, "AFN", locale)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CardMetricIcon href="/orders" />
              {t("dashboard.pendingOrders")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span>{kpis.pendingOrders}</span>
            <Button asChild size="sm" type="button" variant="outline">
              <Link href="/orders">{t("nav.orders")}</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CardMetricIcon href="/products" />
              {t("dashboard.lowStock")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span>{kpis.lowStock}</span>
            <Button asChild size="sm" type="button" variant="outline">
              <Link href="/products">{t("nav.products")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          asChild
          data-icon="inline-start"
          type="button"
          variant="outline"
        >
          <Link href="/pos">
            <ShoppingCart aria-hidden />
            {t("nav.pos")}
          </Link>
        </Button>
        <Button
          asChild
          data-icon="inline-start"
          type="button"
          variant="outline"
        >
          <Link href="/orders">
            <ClipboardList aria-hidden />
            {t("nav.orders")}
          </Link>
        </Button>
        <Button
          data-icon="inline-start"
          onClick={() => {
            refresh().catch(() => undefined);
          }}
          type="button"
          variant="outline"
        >
          <RefreshCw aria-hidden />
          {t("common.refresh")}
        </Button>
      </div>

      <DashboardCharts />
    </main>
  );
}
