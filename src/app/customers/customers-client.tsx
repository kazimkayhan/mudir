"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import {
  type CustomerRow,
  insertCustomer,
  listCustomers,
  listOrdersForCustomer,
  listSalesForCustomer,
  updateCustomer,
} from "@/bridge/customers";
import { exportCustomersCsv } from "@/bridge/data-export";
import { type CustomerLedgerRow, getCustomerLedger } from "@/bridge/invoices";
import { PageTitle } from "@/components/app-icons";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { useModuleTour } from "@/components/onboarding/use-module-tour";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { NumberInput } from "@/components/ui/number-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TranslationKey } from "@/i18n";
import { useI18n } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
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
  useModuleTour();
  const nameId = useId();
  const phoneId = useId();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerRow | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [creditLimit, setCreditLimit] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sales, setSales] = useState<
    { id: string; total_amount: number; channel: string; created_at: string }[]
  >([]);
  const [orders, setOrders] = useState<
    { id: string; status: string; total_amount: number; created_at: string }[]
  >([]);
  const [ledger, setLedger] = useState<CustomerLedgerRow[]>([]);

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
    setBusinessName("");
    setLicenseNumber("");
    setCity("");
    setEmail("");
    setCreditLimit(0);
    setDialogOpen(true);
  };

  const openEdit = (c: CustomerRow) => {
    setEditCustomer(c);
    setName(c.name);
    setPhone(c.phone ?? "");
    setBusinessName(c.business_name ?? "");
    setLicenseNumber(c.license_number ?? "");
    setCity(c.city ?? "");
    setEmail(c.email ?? "");
    setCreditLimit(c.credit_limit ?? 0);
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      const payload = {
        businessName,
        city,
        creditLimit,
        email,
        licenseNumber,
        name,
        phone,
      };
      if (editCustomer) {
        await updateCustomer({ ...payload, id: editCustomer.id });
      } else {
        await insertCustomer(payload);
      }
      setDialogOpen(false);
      toastSuccess(
        t(editCustomer ? "common.toast.updated" : "common.toast.created")
      );
      await refresh();
    } catch (e: unknown) {
      toastTranslatedError(t, e);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const showDetail = async (id: string) => {
    setDetailId(id);
    const [s, o, ledgerRows] = await Promise.all([
      listSalesForCustomer(id),
      listOrdersForCustomer(id),
      getCustomerLedger(id),
    ]);
    setSales(s);
    setOrders(o);
    setLedger(ledgerRows);
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
          <div className="flex gap-2">
            <Button
              data-icon="inline-start"
              data-tour="customers-add"
              onClick={openCreate}
              type="button"
            >
              <Plus aria-hidden />
              {t("common.add")}
            </Button>
            <Button
              onClick={() => {
                exportCustomersCsv()
                  .then(() => toastSuccess(t("common.toast.exported")))
                  .catch((e: unknown) => toastTranslatedError(t, e));
              }}
              type="button"
              variant="outline"
            >
              {t("data.export.customers")}
            </Button>
          </div>
        </div>
      </PageHeader>

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!error && customers.length === 0 ? (
        <EmptyState
          action={{ label: t("common.add"), onClick: openCreate }}
          description={t("onboarding.customers.emptyHint")}
          title={t("common.empty")}
        />
      ) : (
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
      )}

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
            <Field>
              <Label>{t("customers.businessName")}</Label>
              <Input
                onChange={(e) => setBusinessName(e.target.value)}
                value={businessName}
              />
            </Field>
            <Field>
              <Label>{t("customers.licenseNumber")}</Label>
              <Input
                onChange={(e) => setLicenseNumber(e.target.value)}
                value={licenseNumber}
              />
            </Field>
            <Field>
              <Label>{t("setup.city")}</Label>
              <Input onChange={(e) => setCity(e.target.value)} value={city} />
            </Field>
            <Field>
              <Label>{t("auth.email")}</Label>
              <Input
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                value={email}
              />
            </Field>
            <Field>
              <Label>{t("customers.creditLimit")}</Label>
              <NumberInput
                min={0}
                onValueChange={(value) => setCreditLimit(value ?? 0)}
                value={creditLimit}
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
          <Tabs defaultValue="sales">
            <TabsList>
              <TabsTrigger type="button" value="sales">
                {t("nav.pos")}
              </TabsTrigger>
              <TabsTrigger type="button" value="orders">
                {t("nav.orders")}
              </TabsTrigger>
              <TabsTrigger type="button" value="ledger">
                {t("customers.ledger")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="sales">
              <Card>
                <CardContent className="space-y-2 pt-4 text-sm">
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
            </TabsContent>
            <TabsContent value="orders">
              <Card>
                <CardContent className="space-y-2 pt-4 text-sm">
                  {orders.length === 0 ? (
                    <p className="text-muted-foreground">—</p>
                  ) : (
                    orders.map((o) => (
                      <div className="flex justify-between gap-2" key={o.id}>
                        <span>{formatDate(o.created_at, locale)}</span>
                        <span>{orderStatusLabel(o.status, t)}</span>
                        <span>
                          {formatMoney(o.total_amount, "AFN", locale)}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="ledger">
              <Card>
                <CardContent className="space-y-2 pt-4 text-sm">
                  {ledger.length === 0 ? (
                    <p className="text-muted-foreground">—</p>
                  ) : (
                    (() => {
                      let running = 0;
                      return ledger.map((row) => {
                        running += row.debit - row.credit;
                        return (
                          <div
                            className="flex flex-wrap justify-between gap-2 border-b pb-2"
                            key={`${row.type}-${row.id}`}
                          >
                            <span>{row.date}</span>
                            <span>{row.reference}</span>
                            <span>
                              {row.debit > 0
                                ? formatMoney(row.debit, "AFN", locale)
                                : "—"}
                            </span>
                            <span>
                              {row.credit > 0
                                ? formatMoney(row.credit, "AFN", locale)
                                : "—"}
                            </span>
                            <span className="w-full text-muted-foreground text-xs">
                              {t("customers.balance")}:{" "}
                              {formatMoney(running, "AFN", locale)}
                            </span>
                          </div>
                        );
                      });
                    })()
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </main>
  );
}
