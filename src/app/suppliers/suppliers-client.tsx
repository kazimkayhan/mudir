"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { exportSuppliersCsv } from "@/bridge/data-export";
import { listPurchasesForSupplier, type PurchaseRow } from "@/bridge/purchases";
import {
  deleteSupplier,
  insertSupplier,
  listSuppliers,
  type SupplierRow,
  updateSupplier,
} from "@/bridge/suppliers";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
import { formatDate, formatMoney } from "@/lib/format";
import { confirmAction } from "@/lib/native-dialog";
import { isMudirDesktop } from "@/lib/runtime";
import { translateError } from "@/lib/translate-error";

type SupplierWithAp = SupplierRow & { apBalance: number };

function purchaseBalance(purchase: PurchaseRow): number {
  return (
    purchase.balance_due ?? purchase.total_cost - (purchase.amount_paid ?? 0)
  );
}

export function SuppliersClient() {
  const { t, locale } = useI18n();
  useModuleTour();
  const nameId = useId();
  const phoneId = useId();
  const emailId = useId();
  const [suppliers, setSuppliers] = useState<SupplierWithAp[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<SupplierRow | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState<"AFN" | "USD">("USD");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState(0);
  const [bankDetails, setBankDetails] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const rows = await listSuppliers();
      const withAp = await Promise.all(
        rows.map(async (supplier) => {
          const supplierPurchases = await listPurchasesForSupplier(supplier.id);
          const apBalance = supplierPurchases.reduce(
            (sum, purchase) => sum + purchaseBalance(purchase),
            0
          );
          return { ...supplier, apBalance };
        })
      );
      setSuppliers(withAp);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setCountry("");
    setCurrency("USD");
    setEmail("");
    setAddress("");
    setLeadTimeDays(0);
    setBankDetails("");
  };

  const openCreate = () => {
    setEditSupplier(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (supplier: SupplierRow) => {
    setEditSupplier(supplier);
    setName(supplier.name);
    setPhone(supplier.phone ?? "");
    setCountry(supplier.country ?? "");
    setCurrency((supplier.currency as "AFN" | "USD" | null) ?? "USD");
    setEmail(supplier.email ?? "");
    setAddress(supplier.address ?? "");
    setLeadTimeDays(supplier.lead_time_days ?? 0);
    setBankDetails(supplier.bank_details ?? "");
    setDialogOpen(true);
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const payload = {
        address,
        bankDetails,
        country,
        currency,
        email,
        leadTimeDays: leadTimeDays > 0 ? leadTimeDays : undefined,
        name: name.trim(),
        phone: phone.trim() || undefined,
      };
      if (editSupplier) {
        await updateSupplier({ ...payload, id: editSupplier.id });
      } else {
        await insertSupplier(payload);
      }
      setDialogOpen(false);
      toastSuccess(
        t(editSupplier ? "common.toast.updated" : "common.toast.created")
      );
      await refresh();
    } catch (e: unknown) {
      toastTranslatedError(t, e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (supplier: SupplierRow) => {
    const ok = await confirmAction(
      t("purchases.deleteSupplierConfirm"),
      t("purchases.deleteSupplier")
    );
    if (!ok) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await deleteSupplier(supplier.id);
      toastSuccess(t("common.toast.deleted"));
      await refresh();
    } catch (e: unknown) {
      toastTranslatedError(t, e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const showDetail = async (id: string) => {
    setDetailId(id);
    setPurchases(await listPurchasesForSupplier(id));
  };

  const detailSupplier = suppliers.find((supplier) => supplier.id === detailId);

  const columns: ColumnDef<SupplierWithAp>[] = [
    {
      accessorKey: "name",
      header: t("validation.nameRequired"),
    },
    {
      accessorKey: "phone",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value && value.length > 0 ? value : "—";
      },
      header: t("common.phone"),
    },
    {
      accessorKey: "country",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value && value.length > 0 ? value : "—";
      },
      header: t("suppliers.country"),
    },
    {
      accessorKey: "currency",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        if (value === "AFN") {
          return t("common.currency.afn");
        }
        if (value === "USD") {
          return t("common.currency.usd");
        }
        return value ?? "—";
      },
      header: t("suppliers.currency"),
    },
    {
      accessorKey: "email",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value && value.length > 0 ? value : "—";
      },
      header: t("auth.email"),
    },
    {
      accessorKey: "lead_time_days",
      cell: ({ getValue }) => {
        const value = getValue() as number | null;
        return value == null ? "—" : String(value);
      },
      header: t("suppliers.leadTimeDays"),
    },
    {
      accessorKey: "apBalance",
      cell: ({ getValue }) => formatMoney(getValue() as number, "USD", locale),
      header: t("suppliers.apBalance"),
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
            disabled={busy}
            onClick={() => {
              openEdit(row.original);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("common.edit")}
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              remove(row.original).catch(() => undefined);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Trash2 aria-hidden className="size-4" />
            <span className="sr-only">{t("common.delete")}</span>
          </Button>
        </div>
      ),
      enableSorting: false,
      header: t("common.actions"),
      id: "actions",
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 pb-6">
      <PageHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageTitle href="/suppliers">{t("suppliers.title")}</PageTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              data-icon="inline-start"
              disabled={!isMudirDesktop()}
              onClick={openCreate}
              type="button"
            >
              <Plus aria-hidden />
              {t("common.add")}
            </Button>
            <Button
              onClick={() => {
                exportSuppliersCsv()
                  .then(() => toastSuccess(t("common.toast.exported")))
                  .catch((e: unknown) => toastTranslatedError(t, e));
              }}
              type="button"
              variant="outline"
            >
              {t("data.export.suppliers")}
            </Button>
          </div>
        </div>
      </PageHeader>

      {isMudirDesktop() ? null : (
        <Alert className="mt-4">
          <AlertDescription>{t("common.db.tauriOnly")}</AlertDescription>
        </Alert>
      )}

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{translateError(t, error)}</AlertDescription>
        </Alert>
      ) : null}

      {!error && suppliers.length === 0 ? (
        <EmptyState
          action={{
            label: t("common.add"),
            onClick: openCreate,
          }}
          description={t("onboarding.suppliers.emptyHint")}
          title={t("common.empty")}
        />
      ) : (
        <Card className="mt-4">
          <CardContent className="p-0 pt-0">
            <DataTable
              columns={columns}
              data={suppliers}
              getSearchText={(supplier) =>
                [
                  supplier.name,
                  supplier.phone ?? "",
                  supplier.country ?? "",
                  supplier.email ?? "",
                  supplier.address ?? "",
                ].join(" ")
              }
            />
          </CardContent>
        </Card>
      )}

      <p className="mt-4 text-muted-foreground text-sm">
        <Link
          className="text-primary hover:underline"
          href="/purchases/import-shipments"
        >
          {t("importShipments.title")}
        </Link>
      </p>

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t(
                editSupplier
                  ? "purchases.editSupplier"
                  : "suppliers.newSupplier"
              )}
            </DialogTitle>
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
              <Label htmlFor={phoneId}>{t("common.phone")}</Label>
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
              <Label htmlFor={emailId}>{t("auth.email")}</Label>
              <Input
                dir="auto"
                id={emailId}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                type="email"
                value={email}
              />
            </Field>
            <Field>
              <Label>{t("suppliers.country")}</Label>
              <Input
                dir="auto"
                onChange={(e) => {
                  setCountry(e.target.value);
                }}
                value={country}
              />
            </Field>
            <Field>
              <Label>{t("suppliers.address")}</Label>
              <Textarea
                dir="auto"
                onChange={(e) => {
                  setAddress(e.target.value);
                }}
                rows={2}
                value={address}
              />
            </Field>
            <Field>
              <Label>{t("suppliers.currency")}</Label>
              <Select
                onValueChange={(value) => {
                  setCurrency(value as "AFN" | "USD");
                }}
                value={currency}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">
                    {t("common.currency.usd")}
                  </SelectItem>
                  <SelectItem value="AFN">
                    {t("common.currency.afn")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label>{t("suppliers.leadTimeDays")}</Label>
              <NumberInput
                min={0}
                onValueChange={setLeadTimeDays}
                value={leadTimeDays}
              />
            </Field>
            <Field>
              <Label>{t("suppliers.bankDetails")}</Label>
              <Textarea
                dir="auto"
                onChange={(e) => {
                  setBankDetails(e.target.value);
                }}
                rows={3}
                value={bankDetails}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              onClick={() => {
                setDialogOpen(false);
              }}
              type="button"
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button
              disabled={busy || !name.trim() || !isMudirDesktop()}
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

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
          }
        }}
        open={detailId !== null}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detailSupplier?.name ?? t("suppliers.title")}
            </DialogTitle>
          </DialogHeader>
          {detailSupplier ? (
            <div className="space-y-4 text-sm">
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{t("common.phone")}</dt>
                  <dd>{detailSupplier.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("auth.email")}</dt>
                  <dd>{detailSupplier.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("suppliers.country")}
                  </dt>
                  <dd>{detailSupplier.country ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("suppliers.currency")}
                  </dt>
                  <dd>{detailSupplier.currency ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("suppliers.leadTimeDays")}
                  </dt>
                  <dd>
                    {detailSupplier.lead_time_days == null
                      ? "—"
                      : detailSupplier.lead_time_days}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("suppliers.apBalance")}
                  </dt>
                  <dd>
                    {formatMoney(detailSupplier.apBalance, "USD", locale)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">
                    {t("suppliers.address")}
                  </dt>
                  <dd className="whitespace-pre-wrap">
                    {detailSupplier.address ?? "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">
                    {t("suppliers.bankDetails")}
                  </dt>
                  <dd className="whitespace-pre-wrap">
                    {detailSupplier.bank_details ?? "—"}
                  </dd>
                </div>
              </dl>

              <div>
                <h3 className="mb-2 font-medium">{t("purchases.title")}</h3>
                {purchases.length === 0 ? (
                  <p className="text-muted-foreground">{t("common.empty")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("purchases.reference")}</TableHead>
                        <TableHead>{t("purchases.totalCost")}</TableHead>
                        <TableHead>{t("suppliers.apBalance")}</TableHead>
                        <TableHead>{t("inventory.col.date")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell>{purchase.reference ?? "—"}</TableCell>
                          <TableCell>
                            {formatMoney(
                              purchase.total_cost,
                              purchase.currency_code as "AFN" | "USD",
                              locale
                            )}
                          </TableCell>
                          <TableCell>
                            {formatMoney(
                              purchaseBalance(purchase),
                              purchase.currency_code as "AFN" | "USD",
                              locale
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDate(purchase.created_at, locale)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
