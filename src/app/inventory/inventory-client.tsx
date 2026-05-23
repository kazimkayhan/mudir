"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  applyStockMovement,
  listStockMovements,
  type StockMovementListRow,
} from "@/bridge/inventory";
import { listProducts, type ProductRow } from "@/bridge/products";
import { PageTitle } from "@/components/app-icons";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ProductCombobox } from "@/components/product-combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  formValuesToDelta,
  type InventoryFormValues,
  inventoryFormSchema,
} from "@/domain/inventory/schemas";
import { useI18n } from "@/i18n/hooks";
import { parseNumberInput } from "@/lib/number-input";
import { isMudirDesktop } from "@/lib/runtime";
import { translateError } from "@/lib/translate-error";

const MOVEMENT_TYPE_KEYS = {
  adjustment: "inventory.type.adjustment",
  opening: "inventory.type.opening",
  purchase: "inventory.type.purchase",
  return: "inventory.type.return",
  sale: "inventory.type.sale",
} as const;

export function InventoryClient() {
  const { t, locale } = useI18n();
  const uid = useId();
  const recordHeadingId = `${uid}-record`;
  const historyHeadingId = `${uid}-history`;
  const productFieldId = `${uid}-product`;
  const adjFieldId = `${uid}-adj`;
  const qtyFieldId = `${uid}-qty`;

  const [movements, setMovements] = useState<StockMovementListRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const [m, p] = await Promise.all([
        listStockMovements(200),
        listProducts(),
      ]);
      setMovements(m);
      setProducts(p);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setLoadError(translateError(t, message));
    }
  }, [t]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InventoryFormValues>({
    defaultValues: {
      adjustmentDelta: undefined,
      movementType: "purchase",
      productId: "",
      qty: 1,
    },
    resolver: zodResolver(inventoryFormSchema),
  });

  const movementType = watch("movementType");

  const onSubmit = handleSubmit(async (values) => {
    setLoadError(null);
    const delta = formValuesToDelta(values);
    const refId = `inv-${crypto.randomUUID()}`;
    try {
      await applyStockMovement({
        product_id: values.productId,
        quantity_delta: delta,
        ref_id: refId,
        type: values.movementType,
      });
      reset({
        adjustmentDelta: undefined,
        movementType: values.movementType,
        productId: values.productId,
        qty: 1,
      });
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setLoadError(translateError(t, message));
    }
  });

  const columns = useMemo<ColumnDef<StockMovementListRow>[]>(
    () => [
      {
        accessorKey: "created_at",
        cell: ({ getValue }) => {
          try {
            return new Date(getValue() as string).toLocaleString(locale);
          } catch {
            return String(getValue());
          }
        },
        header: t("inventory.col.date"),
        sortingFn: "alphanumeric",
      },
      {
        accessorKey: "product_name",
        cell: ({ row }) =>
          row.original.product_name ?? row.original.product_id.slice(0, 8),
        header: t("inventory.col.product"),
      },
      {
        accessorKey: "type",
        cell: ({ getValue }) => {
          const type = getValue() as keyof typeof MOVEMENT_TYPE_KEYS;
          return type in MOVEMENT_TYPE_KEYS
            ? t(MOVEMENT_TYPE_KEYS[type])
            : String(getValue());
        },
        header: t("inventory.col.type"),
      },
      { accessorKey: "quantity_delta", header: t("inventory.col.delta") },
      {
        accessorKey: "ref_id",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue() as string}</span>
        ),
        header: t("purchases.reference"),
      },
    ],
    [locale, t]
  );

  return (
    <main className="mx-auto max-w-5xl px-6 pb-6">
      <PageHeader>
        <PageTitle href="/inventory">{t("inventory.title")}</PageTitle>
      </PageHeader>

      {isMudirDesktop() ? null : (
        <Alert className="mt-4">
          <AlertDescription>{t("common.db.tauriOnly")}</AlertDescription>
        </Alert>
      )}

      {loadError ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle id={recordHeadingId}>{t("inventory.record")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <Label htmlFor={productFieldId}>{t("inventory.product")}</Label>
                <Controller
                  control={control}
                  name="productId"
                  render={({ field }) => (
                    <ProductCombobox
                      allowNone
                      id={productFieldId}
                      onValueChange={field.onChange}
                      products={products}
                      showStock
                      value={field.value}
                    />
                  )}
                />
                {errors.productId ? (
                  <span className="text-destructive text-xs">
                    {translateError(t, errors.productId.message ?? "")}
                  </span>
                ) : null}
              </Field>

              <Field>
                <Label>{t("inventory.movementType")}</Label>
                <Controller
                  control={control}
                  name="movementType"
                  render={({ field }) => (
                    <RadioGroup
                      className="flex flex-wrap gap-x-4 gap-y-2"
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      {(
                        [
                          ["purchase", "inventory.type.purchase"],
                          ["return", "inventory.type.return"],
                          ["sale", "inventory.type.sale"],
                          ["adjustment", "inventory.type.adjustment"],
                        ] as const
                      ).map(([value, labelKey]) => {
                        const optionId = `${uid}-movement-${value}`;
                        return (
                          <div
                            className="flex items-center gap-1.5 text-sm"
                            key={value}
                          >
                            <RadioGroupItem id={optionId} value={value} />
                            <Label className="font-normal" htmlFor={optionId}>
                              {t(labelKey)}
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  )}
                />
              </Field>

              {movementType === "adjustment" ? (
                <Field>
                  <Label htmlFor={adjFieldId}>
                    {t("inventory.adjustment")}
                  </Label>
                  <Input
                    className="max-w-xs"
                    id={adjFieldId}
                    step={1}
                    type="number"
                    {...register("adjustmentDelta", {
                      setValueAs: (value) => parseNumberInput(String(value)),
                    })}
                  />
                  {errors.adjustmentDelta ? (
                    <span className="text-destructive text-xs">
                      {translateError(t, errors.adjustmentDelta.message ?? "")}
                    </span>
                  ) : null}
                </Field>
              ) : (
                <Field>
                  <Label htmlFor={qtyFieldId}>{t("inventory.qty")}</Label>
                  <Input
                    className="max-w-xs"
                    id={qtyFieldId}
                    min={1}
                    step={1}
                    type="number"
                    {...register("qty", {
                      setValueAs: (value) => parseNumberInput(String(value), 0),
                    })}
                  />
                  {errors.qty ? (
                    <span className="text-destructive text-xs">
                      {translateError(t, errors.qty.message ?? "")}
                    </span>
                  ) : null}
                </Field>
              )}

              <div className="flex gap-2">
                <Button
                  disabled={isSubmitting || products.length === 0}
                  type="submit"
                >
                  {isSubmitting ? t("common.loading") : t("inventory.apply")}
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
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle id={historyHeadingId}>{t("inventory.history")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={movements}
            getSearchText={(movement) =>
              [
                movement.product_name ?? movement.product_id,
                movement.type,
                movement.ref_id,
              ].join(" ")
            }
            tableClassName="min-w-[640px]"
          />
        </CardContent>
      </Card>
    </main>
  );
}
