"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import {
  type CustomerRow,
  insertCustomer,
  listCustomers,
  listOrdersForCustomer,
  listSalesForCustomer,
  updateCustomer,
} from "@/bridge/customers";
import { PageTitle } from "@/components/app-icons";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TranslationKey } from "@/i18n";
import { useI18n } from "@/i18n/hooks";
import { formatDate, formatMoney } from "@/lib/format";

function saleChannelLabel(
  channel: string,
  t: (key: TranslationKey) => string
): string {
  if (channel === "in_store") {
    return t("reports.inStore");
  }
  if (channel === "online") {
    return t("reports.online");
  }
  return channel;
}

function orderStatusLabel(
  status: string,
  t: (key: TranslationKey) => string
): string {
  const key = `orders.status.${status}` as TranslationKey;
  const translated = t(key);
  return translated === key ? status : translated;
}

export function CustomersClient() {
  const { t, locale } = useI18n();
  const nameId = useId();
  const phoneId = useId();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerRow | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sales, setSales] = useState<
    { id: string; total_amount: number; channel: string; created_at: string }[]
  >([]);
  const [orders, setOrders] = useState<
    { id: string; status: string; total_amount: number; created_at: string }[]
  >([]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setCustomers(await listCustomers());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const openCreate = () => {
    setEditCustomer(null);
    setName("");
    setPhone("");
    setDialogOpen(true);
  };

  const openEdit = (c: CustomerRow) => {
    setEditCustomer(c);
    setName(c.name);
    setPhone(c.phone ?? "");
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      if (editCustomer) {
        await updateCustomer({
          id: editCustomer.id,
          name,
          phone,
        });
      } else {
        await insertCustomer({ name, phone });
      }
      setDialogOpen(false);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const showDetail = async (id: string) => {
    setDetailId(id);
    const [s, o] = await Promise.all([
      listSalesForCustomer(id),
      listOrdersForCustomer(id),
    ]);
    setSales(s);
    setOrders(o);
  };

  const columns: ColumnDef<CustomerRow>[] = [
    {
      accessorKey: "name",
      header: t("validation.nameRequired"),
    },
    {
      accessorKey: "phone",
      cell: ({ getValue }) => {
        const phone = getValue() as string | null;
        return phone && phone.length > 0 ? phone : "—";
      },
      header: t("orders.source.phone"),
    },
    {
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              showDetail(row.original.id).catch(() => undefined);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("common.view")}
          </Button>
          <Button
            onClick={() => {
              openEdit(row.original);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("common.edit")}
          </Button>
        </div>
      ),
      enableSorting: false,
      header: t("common.actions"),
      id: "actions",
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 pb-6">
      <PageHeader>
        <div className="flex items-center justify-between gap-4">
          <PageTitle href="/customers">{t("customers.title")}</PageTitle>
          <Button data-icon="inline-start" onClick={openCreate} type="button">
            <Plus aria-hidden />
            {t("common.add")}
          </Button>
        </div>
      </PageHeader>

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="mt-4">
        <CardContent className="p-0 pt-0">
          <DataTable
            columns={columns}
            data={customers}
            getSearchText={(customer) =>
              [customer.name, customer.phone ?? ""].join(" ")
            }
          />
        </CardContent>
      </Card>

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.add")}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <Label htmlFor={nameId}>{t("validation.nameRequired")}</Label>
              <Input
                dir="auto"
                id={nameId}
                onChange={(e) => {
                  setName(e.target.value);
                }}
                value={name}
              />
            </Field>
            <Field>
              <Label htmlFor={phoneId}>{t("orders.source.phone")}</Label>
              <Input
                dir="auto"
                id={phoneId}
                onChange={(e) => {
                  setPhone(e.target.value);
                }}
                value={phone}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              onClick={() => setDialogOpen(false)}
              type="button"
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                save().catch(() => undefined);
              }}
              type="button"
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={() => setDetailId(null)} open={detailId !== null}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("customers.history")}</DialogTitle>
          </DialogHeader>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  href="/pos"
                >
                  {t("nav.pos")}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {sales.length === 0 ? (
                <p className="text-muted-foreground">—</p>
              ) : (
                sales.map((s) => (
                  <div className="flex justify-between gap-2" key={s.id}>
                    <span>{formatDate(s.created_at, locale)}</span>
                    <span>
                      {formatMoney(s.total_amount, "AFN", locale)} (
                      {saleChannelLabel(s.channel, t)})
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  href="/orders"
                >
                  {t("nav.orders")}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {orders.length === 0 ? (
                <p className="text-muted-foreground">—</p>
              ) : (
                orders.map((o) => (
                  <div className="flex justify-between gap-2" key={o.id}>
                    <span>{formatDate(o.created_at, locale)}</span>
                    <span>{orderStatusLabel(o.status, t)}</span>
                    <span>{formatMoney(o.total_amount, "AFN", locale)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </main>
  );
}
