"use client";

import {
  AlertTriangle,
  FileText,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listExpiringBatches } from "@/bridge/batches";
import { getTotalExpensesSince } from "@/bridge/expenses";
import { getTotalArOutstanding } from "@/bridge/invoices";
import { listLowStockProducts } from "@/bridge/products";
import { getTotalApOutstanding } from "@/bridge/purchase-payments";
import { getDashboardSalesTotals } from "@/bridge/sales";
import { PageTitle } from "@/components/app-icons";
import { GettingStartedChecklist } from "@/components/onboarding/getting-started-checklist";
import { useModuleTour } from "@/components/onboarding/use-module-tour";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/hooks";
import { formatMoney } from "@/lib/format";
import { DashboardCharts } from "./dashboard-charts";

export default function DashboardPage() {
  const { t, locale } = useI18n();
  useModuleTour();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    apOutstanding: 0,
    arOutstanding: 0,
    expiringLots: 0,
    inStoreToday: 0,
    lowStock: 0,
    monthExpenses: 0,
    onlineToday: 0,
    pendingOrders: 0,
  });

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = `${today.slice(0, 7)}-01T00:00:00.000Z`;
      const [totals, lowStock, monthExpenses, ar, ap, expiring] =
        await Promise.all([
          getDashboardSalesTotals(),
          listLowStockProducts(),
          getTotalExpensesSince(monthStart),
          getTotalArOutstanding(),
          getTotalApOutstanding(),
          listExpiringBatches(30),
        ]);
      setKpis({
        apOutstanding: ap,
        arOutstanding: ar,
        expiringLots: expiring.length,
        inStoreToday: totals.inStoreToday,
        lowStock: lowStock.length,
        monthExpenses,
        onlineToday: totals.onlineToday,
        pendingOrders: totals.pendingOrders,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  return (
    <main className="mx-auto max-w-5xl px-6 pb-6">
      <PageHeader>
        <PageTitle href="/dashboard">{t("dashboard.title")}</PageTitle>
      </PageHeader>

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="mt-6" data-tour="dashboard-kpis">
        <h2 className="mb-3 font-medium text-muted-foreground text-sm">
          {t("dashboard.today")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            href="/pos"
            icon={<ShoppingCart aria-hidden className="size-4 text-primary" />}
            loading={loading}
            title={t("dashboard.todayInStore")}
            value={formatMoney(kpis.inStoreToday, "AFN", locale)}
          />
          <KpiCard
            href="/orders"
            icon={<TrendingUp aria-hidden className="size-4 text-primary" />}
            loading={loading}
            title={t("dashboard.todayOnline")}
            value={formatMoney(kpis.onlineToday, "AFN", locale)}
          />
          <KpiCard
            href="/invoices"
            icon={<Receipt aria-hidden className="size-4 text-primary" />}
            loading={loading}
            title={t("dashboard.arOutstanding")}
            value={formatMoney(kpis.arOutstanding, "AFN", locale)}
          />
          <KpiCard
            href="/purchases"
            icon={<Truck aria-hidden className="size-4 text-primary" />}
            loading={loading}
            title={t("dashboard.apOutstanding")}
            value={formatMoney(kpis.apOutstanding, "USD", locale)}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-medium text-muted-foreground text-sm">
          {t("dashboard.attention")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            href="/orders"
            icon={<FileText aria-hidden className="size-4 text-amber-600" />}
            loading={loading}
            title={t("dashboard.pendingOrders")}
            value={String(kpis.pendingOrders)}
          />
          <KpiCard
            href="/products"
            icon={<Package aria-hidden className="size-4 text-amber-600" />}
            loading={loading}
            title={t("dashboard.lowStock")}
            value={String(kpis.lowStock)}
          />
          <KpiCard
            href="/inventory"
            icon={
              <AlertTriangle aria-hidden className="size-4 text-amber-600" />
            }
            loading={loading}
            title={t("dashboard.expiringLots")}
            value={String(kpis.expiringLots)}
          />
        </div>
      </section>

      <section className="mt-8" data-tour="dashboard-shortcuts">
        <h2 className="mb-3 font-medium text-muted-foreground text-sm">
          {t("dashboard.shortcuts")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="default">
            <Link href="/invoices/new">{t("dashboard.newInvoice")}</Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/pos">{t("nav.pos")}</Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/purchases">{t("dashboard.receiveStock")}</Link>
          </Button>
          <Button
            asChild
            data-icon="inline-start"
            type="button"
            variant="outline"
          >
            <Link href="/customers">
              <Users aria-hidden />
              {t("dashboard.addCustomer")}
            </Link>
          </Button>
        </div>
      </section>

      <GettingStartedChecklist />

      <div className="mt-8">
        <DashboardCharts />
      </div>
    </main>
  );
}

function KpiCard({
  href,
  icon,
  loading,
  title,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  loading: boolean;
  title: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <span className="font-semibold text-lg">{value}</span>
        )}
        <Button asChild size="sm" type="button" variant="ghost">
          <Link href={href as Route}>{title}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
