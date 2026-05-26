"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  type ImportShipmentRow,
  listImportShipments,
  shipmentTotalCosts,
} from "@/bridge/import-shipments";
import { PageTitle } from "@/components/app-icons";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n/hooks";
import { formatMoney } from "@/lib/format";

export default function ImportShipmentsPage() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<ImportShipmentRow[]>([]);

  const load = useCallback(async () => {
    setRows(await listImportShipments());
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl px-6 pb-6">
      <PageHeader>
        <div className="flex items-center justify-between gap-4">
          <PageTitle href="/purchases">{t("importShipments.title")}</PageTitle>
          <Button asChild type="button" variant="outline">
            <Link href="/purchases">{t("nav.purchases")}</Link>
          </Button>
        </div>
      </PageHeader>
      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>{t("common.status")}</TableHead>
            <TableHead>{t("suppliers.title")}</TableHead>
            <TableHead>{t("common.total")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                className="py-8 text-center text-muted-foreground"
                colSpan={3}
              >
                {t("common.empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Badge variant="outline">{row.status}</Badge>
                </TableCell>
                <TableCell>{row.supplier_name ?? row.reference}</TableCell>
                <TableCell>
                  {formatMoney(
                    shipmentTotalCosts(row),
                    row.currency_code as "USD",
                    locale
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </main>
  );
}
