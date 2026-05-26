"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { listProducts, type ProductRow } from "@/bridge/products";
import {
  getPurchaseDetail,
  listPurchases,
  type PurchaseRow,
  recordPurchase,
} from "@/bridge/purchases";
import {
  deleteSupplier,
  insertSupplier,
  listSuppliers,
  type SupplierRow,
  updateSupplier,
} from "@/bridge/suppliers";
import { PageTitle } from "@/components/app-icons";
import { DataTable } from "@/components/data-table";
import {
  BatchReceiveFields,
  type ReceiveLineMeta,
} from "@/components/inventory/batch-receive-fields";
import { useModuleTour } from "@/components/onboarding/use-module-tour";
import { PageHeader } from "@/components/page-header";
import { ProductCombobox } from "@/components/product-combobox";
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
import { useI18n } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
import { formatDate, formatMoney } from "@/lib/format";
import { confirmAction } from "@/lib/native-dialog";
import { isMudirDesktop } from "@/lib/runtime";
import { translateError } from "@/lib/translate-error";

interface DraftLine {
  key: string;
  productId: string;
  qty: number;
  unitCost: number;
}

export function PurchasesClient() {
  const { t, locale } = useI18n();
  const uid = useId();
  const supNameId = `${uid}-sup-name`;
  const supPhoneId = `${uid}-sup-phone`;
  const refId = `${uid}-ref`;
  const notesId = `${uid}-notes`;

  const supEditNameId = `${uid}-sup-edit-name`;
  const supEditPhoneId = `${uid}-sup-edit-phone`;

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [receiveMeta, setReceiveMeta] = useState<
    Record<string, ReceiveLineMeta>
  >({});
  const [pickProduct, setPickProduct] = useState("");
  const [lineQty, setLineQty] = useState(0);
  const [lineCost, setLineCost] = useState(0);
  const [newSupName, setNewSupName] = useState("");
  const [newSupPhone, setNewSupPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] =
    useState<Awaited<ReturnType<typeof getPurchaseDetail>>>(null);
  const [editSupplier, setEditSupplier] = useState<SupplierRow | null>(null);
  const [editSupName, setEditSupName] = useState("");
  const [editSupPhone, setEditSupPhone] = useState("");
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [p, s, pur] = await Promise.all([
        listProducts(),
        listSuppliers(),
        listPurchases(50),
      ]);
      setProducts(p);
      setSuppliers(s);
      setPurchases(pur);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(translateError(t, message));
    }
  }, [t]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const openDetail = async (purchaseId: string) => {
    setDetailId(purchaseId);
    setDetail(await getPurchaseDetail(purchaseId));
  };

  const addLine = () => {
    setError(null);
    if (!pickProduct) {
      setError(t("validation.nameRequired"));
      return;
    }
    if (lineQty < 1 || !Number.isInteger(lineQty)) {
      setError(t("validation.qtyMinZero"));
      return;
    }
    if (lineCost < 0 || Number.isNaN(lineCost)) {
      setError(t("validation.amountPositive"));
      return;
    }
    const key = crypto.randomUUID();
    setLines((prev) => [
      ...prev,
      {
        key,
        productId: pickProduct,
        qty: lineQty,
        unitCost: lineCost,
      },
    ]);
    setReceiveMeta((prev) => ({
      ...prev,
      [key]: {
        serialSlots: Array.from({ length: lineQty }, () => ({
          id: crypto.randomUUID(),
          value: "",
        })),
      },
    }));
    setLineQty(0);
    setLineCost(0);
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
    setReceiveMeta((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addSupplier = async () => {
    setError(null);
    setBusy(true);
    try {
      await insertSupplier({
        name: newSupName.trim(),
        phone: newSupPhone.trim() || undefined,
      });
      setNewSupName("");
      setNewSupPhone("");
      toastSuccess(t("purchases.toast.supplierSaved"));
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toastTranslatedError(t, e);
      setError(translateError(t, message));
    } finally {
      setBusy(false);
    }
  };

  const openEditSupplier = (s: SupplierRow) => {
    setEditSupplier(s);
    setEditSupName(s.name);
    setEditSupPhone(s.phone ?? "");
    setSupplierDialogOpen(true);
  };

  const saveEditSupplier = async () => {
    if (!editSupplier) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await updateSupplier({
        id: editSupplier.id,
        name: editSupName.trim(),
        phone: editSupPhone.trim() || undefined,
      });
      setSupplierDialogOpen(false);
      setEditSupplier(null);
      toastSuccess(t("purchases.toast.supplierSaved"));
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toastTranslatedError(t, e);
      setError(translateError(t, message));
    } finally {
      setBusy(false);
    }
  };

  const removeSupplier = async (s: SupplierRow) => {
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
      await deleteSupplier(s.id);
      if (supplierId === s.id) {
        setSupplierId("");
      }
      toastSuccess(t("purchases.toast.supplierDeleted"));
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toastTranslatedError(t, e);
      setError(translateError(t, message));
    } finally {
      setBusy(false);
    }
  };

  const supplierColumns: ColumnDef<SupplierRow>[] = [
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
      header: t("common.phone"),
    },
    {
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            disabled={!isMudirDesktop()}
            onClick={() => openEditSupplier(row.original)}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("common.edit")}
          </Button>
          <Button
            className="text-destructive"
            data-icon="inline-start"
            disabled={busy || !isMudirDesktop()}
            onClick={() => {
              removeSupplier(row.original).catch(() => undefined);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Trash2 aria-hidden />
            {t("common.delete")}
          </Button>
        </div>
      ),
      enableSorting: false,
      header: t("common.actions"),
      id: "actions",
    },
  ];

  const submitPurchase = async () => {
    setError(null);
    if (lines.length === 0) {
      setError(t("validation.nameRequired"));
      return;
    }
    setBusy(true);
    try {
      await recordPurchase({
        lines: lines.map((l) => {
          const product = products.find((p) => p.id === l.productId);
          const meta = receiveMeta[l.key];
          return {
            expiryDate: meta?.expiryDate,
            lotNumber: meta?.lotNumber,
            productId: l.productId,
            quantity: l.qty,
            serialNumbers:
              product?.tracking_mode === "serial"
                ? meta?.serialSlots.map((slot) => slot.value)
                : undefined,
            unitCost: l.unitCost,
          };
        }),
        notes: notes.trim() || undefined,
        reference: reference.trim() || undefined,
        supplierId: supplierId || undefined,
      });
      setLines([]);
      setReference("");
      setNotes("");
      toastSuccess(t("purchases.toast.recorded"));
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toastTranslatedError(t, e);
      setError(translateError(t, message));
    } finally {
      setBusy(false);
    }
  };

  useModuleTour();

  return (
    <main className="mx-auto max-w-4xl px-6 pb-6">
      <PageHeader>
        <PageTitle href="/purchases">{t("purchases.title")}</PageTitle>
      </PageHeader>

      {isMudirDesktop() ? null : (
        <Alert className="mt-4">
          <AlertDescription>{t("common.db.tauriOnly")}</AlertDescription>
        </Alert>
      )}

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t("purchases.newSupplier")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <Field className="min-w-40">
              <Label htmlFor={supNameId}>{t("validation.nameRequired")}</Label>
              <Input
                dir="auto"
                id={supNameId}
                onChange={(e) => setNewSupName(e.target.value)}
                value={newSupName}
              />
            </Field>
            <Field className="min-w-40">
              <Label htmlFor={supPhoneId}>{t("common.phone")}</Label>
              <Input
                dir="auto"
                id={supPhoneId}
                onChange={(e) => setNewSupPhone(e.target.value)}
                value={newSupPhone}
              />
            </Field>
            <Button
              data-icon="inline-start"
              disabled={busy || !newSupName.trim() || !isMudirDesktop()}
              onClick={() => {
                addSupplier().catch(() => undefined);
              }}
              type="button"
            >
              <Plus aria-hidden />
              {t("purchases.saveSupplier")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t("purchases.suppliers")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={supplierColumns}
            data={suppliers}
            getSearchText={(supplier) =>
              [supplier.name, supplier.phone ?? ""].join(" ")
            }
          />
        </CardContent>
      </Card>

      <Card className="mt-8" data-tour="purchases-new">
        <CardHeader>
          <CardTitle>{t("purchases.record")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label>{t("purchases.supplier")}</Label>
              <Select
                onValueChange={(v) => setSupplierId(v === "__none__" ? "" : v)}
                value={supplierId || "__none__"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor={refId}>{t("purchases.reference")}</Label>
              <Input
                dir="auto"
                id={refId}
                onChange={(e) => setReference(e.target.value)}
                value={reference}
              />
            </Field>
            <Field className="sm:col-span-2">
              <Label htmlFor={notesId}>{t("purchases.notes")}</Label>
              <Input
                dir="auto"
                id={notesId}
                onChange={(e) => setNotes(e.target.value)}
                value={notes}
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-3 border-border border-t pt-4">
            <ProductCombobox
              allowNone
              onValueChange={setPickProduct}
              placeholder={t("nav.products")}
              products={products}
              triggerClassName="min-w-[12rem]"
              value={pickProduct}
            />
            <NumberInput
              aria-label={t("purchases.qty")}
              className="w-20"
              onValueChange={setLineQty}
              value={lineQty}
            />
            <NumberInput
              aria-label={t("purchases.unitCost")}
              className="w-28"
              onValueChange={setLineCost}
              step="any"
              value={lineCost}
            />
            <Button
              data-icon="inline-start"
              onClick={addLine}
              type="button"
              variant="outline"
            >
              <Plus aria-hidden />
              {t("purchases.addLine")}
            </Button>
          </div>

          <Card className="mt-4 shadow-none">
            <CardContent className="space-y-2 p-0 pt-0">
              {lines.length === 0 ? (
                <p className="px-4 py-2 text-muted-foreground text-sm">—</p>
              ) : (
                lines.map((l) => {
                  const product = products.find((p) => p.id === l.productId);
                  const name = product?.name ?? l.productId;
                  const meta = receiveMeta[l.key] ?? { serialSlots: [] };
                  return (
                    <Card className="mx-4 shadow-none" key={l.key}>
                      <CardContent className="space-y-3 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link
                            className="text-primary underline-offset-4 hover:underline"
                            href="/products"
                          >
                            {name}
                          </Link>
                          <span>
                            {l.qty} × {formatMoney(l.unitCost, "AFN", locale)}
                          </span>
                          <Button
                            className="h-auto px-0 text-destructive"
                            onClick={() => removeLine(l.key)}
                            size="sm"
                            type="button"
                            variant="link"
                          >
                            {t("common.delete")}
                          </Button>
                        </div>
                        {product ? (
                          <BatchReceiveFields
                            meta={meta}
                            onChange={(next) =>
                              setReceiveMeta((prev) => ({
                                ...prev,
                                [l.key]: next,
                              }))
                            }
                            product={product}
                          />
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Button
            className="mt-4"
            disabled={busy || lines.length === 0 || !isMudirDesktop()}
            onClick={() => {
              submitPurchase().catch(() => undefined);
            }}
            type="button"
          >
            {busy ? t("common.loading") : t("purchases.submit")}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle>{t("purchases.recent")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {purchases.length === 0 ? (
              <li className="px-4 py-6 text-muted-foreground text-sm">—</li>
            ) : (
              purchases.map((p) => (
                <li className="px-4 py-2 text-sm" key={p.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-mono text-xs opacity-70">
                        {p.id.slice(0, 10)}…
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>{t("purchases.totalCost")}</span>
                        <span>
                          {formatMoney(
                            Number(p.total_cost),
                            p.currency_code as "AFN" | "USD",
                            locale
                          )}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {formatDate(p.created_at, locale)}
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        openDetail(p.id).catch(() => undefined);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {t("purchases.detail")}
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>

      <Dialog onOpenChange={setSupplierDialogOpen} open={supplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("purchases.editSupplier")}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <Label htmlFor={supEditNameId}>
                {t("validation.nameRequired")}
              </Label>
              <Input
                dir="auto"
                id={supEditNameId}
                onChange={(e) => setEditSupName(e.target.value)}
                value={editSupName}
              />
            </Field>
            <Field>
              <Label htmlFor={supEditPhoneId}>{t("common.phone")}</Label>
              <Input
                dir="auto"
                id={supEditPhoneId}
                onChange={(e) => setEditSupPhone(e.target.value)}
                value={editSupPhone}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              onClick={() => setSupplierDialogOpen(false)}
              type="button"
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button
              disabled={busy || !editSupName.trim()}
              onClick={() => {
                saveEditSupplier().catch(() => undefined);
              }}
              type="button"
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={() => setDetailId(null)} open={detailId !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("purchases.detail")}</DialogTitle>
          </DialogHeader>
          {detail?.purchase ? (
            <div className="space-y-2 text-sm">
              <p>
                {t("purchases.supplier")}:{" "}
                {detail.purchase.supplier_name ?? "—"}
              </p>
              <p>
                {t("purchases.reference")}: {detail.purchase.reference ?? "—"}
              </p>
              <p>
                {t("purchases.totalCost")}:{" "}
                {formatMoney(
                  Number(detail.purchase.total_cost),
                  detail.purchase.currency_code as "AFN" | "USD",
                  locale
                )}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("nav.products")}</TableHead>
                    <TableHead>{t("purchases.qty")}</TableHead>
                    <TableHead>{t("purchases.unitCost")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <Link
                          className="text-primary underline-offset-4 hover:underline"
                          href="/products"
                        >
                          {line.product_name ?? line.product_id}
                        </Link>
                      </TableCell>
                      <TableCell>{line.quantity}</TableCell>
                      <TableCell>
                        {formatMoney(line.unit_cost, "AFN", locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button asChild type="button" variant="outline">
                <Link href="/inventory">{t("nav.inventory")}</Link>
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("common.loading")}
            </p>
          )}
          <DialogFooter>
            <Button
              onClick={() => setDetailId(null)}
              type="button"
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
