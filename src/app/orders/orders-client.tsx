"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listCustomers } from "@/bridge/customers";
import {
  createOnlineOrder,
  fulfillOnlineOrder,
  listOnlineOrders,
  type OnlineOrderRow,
  type OrderSource,
  updateOrderStatus,
} from "@/bridge/orders";
import { listProducts, type ProductRow } from "@/bridge/products";
import { PageTitle } from "@/components/app-icons";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ProductCombobox } from "@/components/product-combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TranslationKey } from "@/i18n";
import { useI18n } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
import { formatDate, formatMoney } from "@/lib/format";

function orderStatusLabel(
  status: string,
  t: (key: TranslationKey) => string
): string {
  const key = `orders.status.${status}` as TranslationKey;
  const translated = t(key);
  return translated === key ? status : translated;
}

export function OrdersClient() {
  const { t, locale } = useI18n();
  const [orders, setOrders] = useState<OnlineOrderRow[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>(
    []
  );
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [source, setSource] = useState<OrderSource>("phone");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(0);
  const [price, setPrice] = useState(0);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [o, c, p] = await Promise.all([
        listOnlineOrders(),
        listCustomers(),
        listProducts(),
      ]);
      setOrders(o);
      setCustomers(c.map((x) => ({ id: x.id, name: x.name })));
      setProducts(p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    const p = products.find((x) => x.id === productId);
    if (p) {
      setPrice(p.sale_price);
    }
  }, [productId, products]);

  const createOrder = async () => {
    if (!(customerId && productId)) {
      return;
    }
    try {
      await createOnlineOrder({
        customerId,
        items: [{ productId, quantity: qty, unitPrice: price }],
        source,
      });
      setCustomerId("");
      setProductId("");
      toastSuccess(t("orders.toast.created"));
      await refresh();
    } catch (e: unknown) {
      toastTranslatedError(t, e);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const columns = useMemo<ColumnDef<OnlineOrderRow>[]>(
    () => [
      {
        accessorKey: "customer_name",
        cell: ({ row }) =>
          row.original.customer_name ?? row.original.customer_id,
        header: t("customers.title"),
      },
      {
        accessorKey: "status",
        cell: ({ row }) => (
          <Badge variant="outline">
            {orderStatusLabel(row.original.status, t)}
          </Badge>
        ),
        header: t("common.status"),
      },
      {
        accessorKey: "total_amount",
        cell: ({ row }) =>
          formatMoney(
            row.original.total_amount,
            row.original.currency_code as "AFN" | "USD",
            locale
          ),
        header: t("common.total"),
      },
      {
        accessorKey: "created_at",
        cell: ({ getValue }) => formatDate(getValue() as string, locale),
        header: t("inventory.col.date"),
      },
      {
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            {row.original.status === "pending" ? (
              <Button
                onClick={() =>
                  updateOrderStatus(row.original.id, "confirmed")
                    .then(() => {
                      toastSuccess(t("orders.toast.updated"));
                      return refresh();
                    })
                    .catch((e: unknown) => toastTranslatedError(t, e))
                }
                size="sm"
                type="button"
                variant="outline"
              >
                {t("orders.status.confirmed")}
              </Button>
            ) : null}
            {row.original.status !== "completed" &&
            row.original.status !== "cancelled" ? (
              <>
                <Button
                  data-icon="inline-start"
                  onClick={() =>
                    fulfillOnlineOrder(row.original.id)
                      .then(() => {
                        toastSuccess(t("orders.toast.updated"));
                        return refresh();
                      })
                      .catch((e: unknown) => toastTranslatedError(t, e))
                  }
                  size="sm"
                  type="button"
                >
                  <Check aria-hidden />
                  {t("orders.fulfill")}
                </Button>
                <Button
                  onClick={() =>
                    updateOrderStatus(row.original.id, "cancelled")
                      .then(() => {
                        toastSuccess(t("orders.toast.updated"));
                        return refresh();
                      })
                      .catch((e: unknown) => toastTranslatedError(t, e))
                  }
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  {t("orders.cancel")}
                </Button>
              </>
            ) : null}
          </div>
        ),
        enableSorting: false,
        header: t("common.actions"),
        id: "actions",
      },
    ],
    [locale, refresh, t]
  );

  return (
    <main className="mx-auto max-w-5xl px-6 pb-6">
      <PageHeader>
        <PageTitle href="/orders">{t("orders.title")}</PageTitle>
      </PageHeader>

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("orders.new")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label>{t("customers.title")}</Label>
            <Select onValueChange={setCustomerId} value={customerId}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Label>{t("orders.source.phone")}</Label>
            <Select
              onValueChange={(v) => setSource(v as OrderSource)}
              value={source}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">
                  {t("orders.source.phone")}
                </SelectItem>
                <SelectItem value="whatsapp">
                  {t("orders.source.whatsapp")}
                </SelectItem>
                <SelectItem value="web">{t("orders.source.web")}</SelectItem>
                <SelectItem value="other">
                  {t("orders.source.other")}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Label>{t("nav.products")}</Label>
            <ProductCombobox
              onValueChange={setProductId}
              products={products}
              value={productId}
            />
          </Field>
          <div className="flex gap-4">
            <Field className="min-w-0 flex-1">
              <Label>{t("validation.qtyMinZero")}</Label>
              <NumberInput onValueChange={setQty} value={qty} />
            </Field>
            <Field className="min-w-0 flex-1">
              <Label>{t("products.salePrice")}</Label>
              <NumberInput onValueChange={setPrice} value={price} />
            </Field>
          </div>
          <Button
            className="sm:col-span-2"
            data-icon="inline-start"
            onClick={() => {
              createOrder().catch(() => undefined);
            }}
            type="button"
          >
            <Plus aria-hidden />
            {t("orders.new")}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("orders.title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={orders}
            getSearchText={(order) =>
              [
                order.customer_name ?? order.customer_id,
                orderStatusLabel(order.status, t),
              ].join(" ")
            }
          />
        </CardContent>
      </Card>
    </main>
  );
}
