"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useState } from "react";
import { exportInvoicePdf } from "@/bridge/invoice-pdf";
import {
  getInvoiceById,
  getInvoiceItems,
  type InvoiceRow,
  issueInvoice,
  listInvoicePayments,
  recordInvoicePayment,
} from "@/bridge/invoices";
import { PageTitle } from "@/components/app-icons";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
import { formatMoney } from "@/lib/format";

function InvoiceDetailContent() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("id")?.trim() ?? "";
  const amountId = useId();
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [items, setItems] = useState<
    {
      id: string;
      product_name: string | null;
      quantity: number;
      unit_price: number;
    }[]
  >([]);
  const [payments, setPayments] = useState<
    { id: string; amount: number; payment_date: string; method: string }[]
  >([]);
  const [payAmount, setPayAmount] = useState(0);

  const load = useCallback(async () => {
    if (!invoiceId) {
      setInvoice(null);
      setItems([]);
      setPayments([]);
      return;
    }
    const [inv, its, pays] = await Promise.all([
      getInvoiceById(invoiceId),
      getInvoiceItems(invoiceId),
      listInvoicePayments(invoiceId),
    ]);
    setInvoice(inv);
    setItems(its);
    setPayments(pays);
  }, [invoiceId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  if (!invoiceId) {
    return (
      <main className="mx-auto max-w-3xl px-6 pb-6">
        <p className="mt-8 text-muted-foreground text-sm">
          {t("common.empty")}
        </p>
        <Button asChild className="mt-4" type="button" variant="outline">
          <Link href="/invoices">{t("common.back")}</Link>
        </Button>
      </main>
    );
  }

  if (!invoice) {
    return null;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-6">
      <PageHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PageTitle href="/invoices">{invoice.invoice_number}</PageTitle>
          <Badge variant="outline">
            {t(`invoices.status.${invoice.status}` as never)}
          </Badge>
        </div>
      </PageHeader>

      <div className="mt-4 grid gap-2 text-sm">
        <p>
          {t("invoices.customer")}: {invoice.customer_name}
        </p>
        <p>
          {t("common.total")}:{" "}
          {formatMoney(
            invoice.total_amount,
            invoice.currency_code as "AFN",
            locale
          )}
        </p>
        <p>
          {t("invoices.balance")}:{" "}
          {formatMoney(
            invoice.balance_due,
            invoice.currency_code as "AFN",
            locale
          )}
        </p>
      </div>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>{t("nav.products")}</TableHead>
            <TableHead>{t("common.qty")}</TableHead>
            <TableHead>{t("common.price")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.product_name}</TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>
                {formatMoney(
                  item.unit_price,
                  invoice.currency_code as "AFN",
                  locale
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="mt-6 flex flex-wrap gap-2">
        {invoice.status === "draft" ? (
          <Button
            onClick={() => {
              issueInvoice(invoice.id)
                .then(() => {
                  toastSuccess(t("invoices.toast.issued"));
                  return load();
                })
                .catch((e: unknown) => toastTranslatedError(t, e));
            }}
            type="button"
          >
            {t("invoices.issue")}
          </Button>
        ) : null}
        {invoice.status === "draft" ? null : (
          <Button
            onClick={() => {
              exportInvoicePdf(invoice.id, locale)
                .then(() => toastSuccess(t("common.toast.exported")))
                .catch((e: unknown) => toastTranslatedError(t, e));
            }}
            type="button"
            variant="secondary"
          >
            {t("invoices.downloadPdf")}
          </Button>
        )}
        <Button asChild type="button" variant="outline">
          <Link href="/invoices">{t("common.back")}</Link>
        </Button>
      </div>

      {invoice.balance_due > 0 && invoice.status !== "draft" ? (
        <div className="mt-8 rounded-lg border p-4">
          <h3 className="font-medium">{t("invoices.recordPayment")}</h3>
          <Field className="mt-3">
            <Label htmlFor={amountId}>{t("common.total")}</Label>
            <NumberInput
              id={amountId}
              min={0}
              onValueChange={(v) => setPayAmount(v ?? 0)}
              value={payAmount}
            />
          </Field>
          <Button
            className="mt-3"
            onClick={() => {
              recordInvoicePayment({
                amount: payAmount,
                invoice_id: invoice.id,
                payment_date: new Date().toISOString().slice(0, 10),
              })
                .then(() => {
                  toastSuccess(t("invoices.toast.paymentRecorded"));
                  return load();
                })
                .catch((e: unknown) => toastTranslatedError(t, e));
            }}
            type="button"
          >
            {t("invoices.recordPayment")}
          </Button>
        </div>
      ) : null}

      {payments.length > 0 ? (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.total")}</TableHead>
              <TableHead>{t("invoices.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {formatMoney(
                    p.amount,
                    invoice.currency_code as "AFN",
                    locale
                  )}
                </TableCell>
                <TableCell>{p.payment_date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </main>
  );
}

export default function InvoiceViewPage() {
  return (
    <Suspense fallback={null}>
      <InvoiceDetailContent />
    </Suspense>
  );
}
