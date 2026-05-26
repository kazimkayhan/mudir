"use client";

import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { exportProductsCsv } from "@/bridge/data-export";
import {
  listProducts,
  type ProductRow,
  softDeleteProductById,
} from "@/bridge/products";
import { PageTitle } from "@/components/app-icons";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { useTourOptional } from "@/components/onboarding/tour-provider";
import { useModuleTour } from "@/components/onboarding/use-module-tour";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductCondition } from "@/domain/products/schemas";
import { useI18n } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
import { formatDate, formatMoney } from "@/lib/format";
import { alertAction, confirmAction } from "@/lib/native-dialog";
import { isMudirDesktop } from "@/lib/runtime";
import { translateError } from "@/lib/translate-error";
import { ProductEditorDialog } from "./product-editor-dialog";
import { ProductImportDialog } from "./product-import-dialog";

const DEFAULT_SORTING: SortingState = [{ desc: true, id: "created_at" }];

type ConditionFilter = "all" | ProductCondition;

export function ProductsClient() {
  const { t, locale } = useI18n();
  useModuleTour();
  const tour = useTourOptional();
  const conditionFilterId = useId();
  const [data, setData] = useState<ProductRow[]>([]);
  const [conditionFilter, setConditionFilter] =
    useState<ConditionFilter>("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editRow, setEditRow] = useState<ProductRow | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const rows = await listProducts();
      setData(rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setLoadError(translateError(t, message));
    }
  }, [t]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const tableData = useMemo(() => {
    if (conditionFilter === "all") {
      return data;
    }
    return data.filter((product) => product.condition === conditionFilter);
  }, [conditionFilter, data]);

  const conditionLabel = useCallback(
    (condition: ProductCondition) =>
      condition === "used"
        ? t("products.condition.used")
        : t("products.condition.new"),
    [t]
  );

  const columns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("pos.pickProduct"),
      },
      {
        accessorKey: "sku",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v && v.length > 0 ? v : "—";
        },
        header: t("common.sku"),
      },
      {
        accessorKey: "condition",
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.condition === "used" ? "secondary" : "outline"
            }
          >
            {conditionLabel(row.original.condition)}
          </Badge>
        ),
        header: t("products.condition.label"),
      },
      {
        accessorKey: "sale_price",
        cell: ({ row }) =>
          formatMoney(
            row.original.sale_price,
            (row.original.currency as "AFN" | "USD") ?? "AFN",
            locale
          ),
        header: t("products.salePrice"),
        sortingFn: "basic",
      },
      {
        accessorKey: "cost_price",
        cell: ({ row }) =>
          formatMoney(
            row.original.cost_price,
            (row.original.currency as "AFN" | "USD") ?? "AFN",
            locale
          ),
        header: t("products.costPrice"),
        sortingFn: "basic",
      },
      {
        accessorKey: "created_at",
        cell: ({ getValue }) => formatDate(getValue() as string, locale),
        header: t("inventory.col.date"),
        sortingFn: "datetime",
      },
      {
        accessorKey: "on_hand_qty",
        header: t("products.onHand"),
        sortingFn: "basic",
      },
      {
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <Button
              className="h-auto px-0"
              data-icon="inline-start"
              onClick={() => {
                setEditorMode("edit");
                setEditRow(row.original);
                setEditorOpen(true);
              }}
              size="sm"
              type="button"
              variant="link"
            >
              <Pencil aria-hidden className="size-3.5" />
              {t("common.edit")}
            </Button>
            <Button
              className="h-auto px-0 text-destructive"
              data-icon="inline-start"
              onClick={() => {
                (async () => {
                  const ok = await confirmAction(
                    t("products.deleteConfirm"),
                    t("common.delete")
                  );
                  if (!ok) {
                    return;
                  }
                  try {
                    await softDeleteProductById(row.original.id);
                    toastSuccess(t("common.toast.deleted"));
                    await refresh();
                  } catch (e: unknown) {
                    const message = e instanceof Error ? e.message : String(e);
                    await alertAction(
                      translateError(t, message),
                      t("common.error"),
                      "error"
                    );
                  }
                })().catch(() => undefined);
              }}
              size="sm"
              type="button"
              variant="link"
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
    ],
    [conditionLabel, locale, refresh, t]
  );

  return (
    <main className="mx-auto max-w-6xl px-6 pb-6">
      <PageHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <PageTitle href="/products">{t("products.title")}</PageTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              data-icon="inline-start"
              data-tour="products-import"
              onClick={() => {
                setImportOpen(true);
              }}
              type="button"
              variant="outline"
            >
              <Upload aria-hidden />
              {t("products.import.action")}
            </Button>
            <Button
              data-icon="inline-start"
              data-tour="products-add"
              onClick={() => {
                setEditorMode("create");
                setEditRow(null);
                setEditorOpen(true);
              }}
              type="button"
            >
              <Plus aria-hidden />
              {t("products.add")}
            </Button>
            <Button
              onClick={() => {
                exportProductsCsv()
                  .then(() => toastSuccess(t("common.toast.exported")))
                  .catch((e: unknown) => toastTranslatedError(t, e));
              }}
              type="button"
              variant="outline"
            >
              {t("data.export.products")}
            </Button>
          </div>
        </div>
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

      <div className="mt-6 flex justify-end">
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

      {!loadError && data.length === 0 ? (
        <EmptyState
          action={{
            label: t("products.add"),
            onClick: () => {
              setEditorMode("create");
              setEditRow(null);
              setEditorOpen(true);
            },
          }}
          description={t("onboarding.products.emptyHint")}
          secondary={{
            label: t("onboarding.showTour"),
            onClick: () => tour?.startTour("products"),
          }}
          title={t("products.empty")}
        />
      ) : (
        <Card className="mt-4">
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={tableData}
              getSearchText={(product) =>
                [
                  product.name,
                  product.sku ?? "",
                  conditionLabel(product.condition),
                ].join(" ")
              }
              initialSorting={DEFAULT_SORTING}
              searchPlaceholder={t("products.search")}
              toolbar={
                <Field className="min-w-40">
                  <Label htmlFor={conditionFilterId}>
                    {t("products.filter.condition")}
                  </Label>
                  <Select
                    onValueChange={(value) => {
                      setConditionFilter(
                        value === "used" || value === "new" ? value : "all"
                      );
                    }}
                    value={conditionFilter}
                  >
                    <SelectTrigger className="w-40" id={conditionFilterId}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("products.filter.all")}
                      </SelectItem>
                      <SelectItem value="new">
                        {t("products.condition.new")}
                      </SelectItem>
                      <SelectItem value="used">
                        {t("products.condition.used")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              }
            />
          </CardContent>
        </Card>
      )}

      <ProductImportDialog
        onClose={() => {
          setImportOpen(false);
        }}
        onImported={() => {
          refresh().catch(() => undefined);
        }}
        open={importOpen}
      />

      <ProductEditorDialog
        initial={editRow}
        mode={editorMode}
        onClose={() => {
          setEditorOpen(false);
          setEditRow(null);
        }}
        onSaved={() => {
          refresh().catch(() => undefined);
        }}
        open={editorOpen}
      />
    </main>
  );
}
