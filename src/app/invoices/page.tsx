"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type InvoiceRow, listInvoices } from "@/bridge/invoices";
import { PageTitle } from "@/components/app-icons";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { useModuleTour } from "@/components/onboarding/use-module-tour";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n/hooks";
import { invoiceDetailHref } from "@/lib/entity-routes";
import { formatMoney } from "@/lib/format";

export default function InvoicesPage() {
  const { t, locale } = useI18n();
  useModuleTour();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listInvoices());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const columns = useMemo<ColumnDef<InvoiceRow>[]>(
    () => [
      {
        accessorKey: "invoice_number",
        header: t("invoices.number"),
      },
      {
        accessorKey: "customer_name",
        cell: ({ getValue }) => {
          const name = getValue() as string | null;
          return name && name.length > 0 ? name : "—";
        },
        header: t("invoices.customer"),
      },
      {
        accessorKey: "status",
        cell: ({ row }) => (
          <Badge variant="outline">
            {t(`invoices.status.${row.original.status}` as never)}
          </Badge>
        ),
        header: t("invoices.status"),
      },
      {
        accessorKey: "balance_due",
        cell: ({ row }) =>
          formatMoney(
            row.original.balance_due,
            row.original.currency_code,
            locale
          ),
        header: t("invoices.balance"),
      },
      {
        cell: ({ row }) => (
          <Button asChild size="sm" type="button" variant="outline">
            <Link href={invoiceDetailHref(row.original.id)}>
              {t("common.view")}
            </Link>
          </Button>
        ),
        enableSorting: false,
        header: t("common.actions"),
        id: "actions",
      },
    ],
    [locale, t]
  );

  return (
    <main className="mx-auto max-w-5xl px-6 pb-6">
      <PageHeader>
        <div className="flex items-center justify-between gap-4">
          <PageTitle href="/invoices">{t("invoices.title")}</PageTitle>
          <Button asChild data-tour="invoices-new" type="button">
            <Link href="/invoices/new">{t("invoices.new")}</Link>
          </Button>
        </div>
      </PageHeader>

      {!loading && rows.length === 0 ? (
        <EmptyState
          action={{ href: "/invoices/new", label: t("invoices.new") }}
          description={t("onboarding.invoices.emptyHint")}
          title={t("invoices.empty")}
        />
      ) : (
        <Card className="mt-4">
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={rows}
              getSearchText={(row) =>
                [row.invoice_number, row.customer_name ?? ""].join(" ")
              }
              searchPlaceholder={t("common.search")}
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
