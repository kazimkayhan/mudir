"use client";

import { Check, Plus, Printer } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { type CustomerRow, listCustomers } from "@/bridge/customers";
import {
  findProductBySkuOrBarcode,
  listProducts,
  type ProductRow,
} from "@/bridge/products";
import {
  completePosSale,
  getSaleDetail,
  listRecentSales,
  type RecentSaleRow,
  returnPosSale,
  type SaleDetail,
} from "@/bridge/sales";
import { getBusinessSettings } from "@/bridge/settings";
import { PageTitle } from "@/components/app-icons";
import { BatchPickerDialog } from "@/components/inventory/batch-picker-dialog";
import { useModuleTour } from "@/components/onboarding/use-module-tour";
import { PageHeader } from "@/components/page-header";
import { ProductCombobox } from "@/components/product-combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
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
import { computePosTotals } from "@/domain/sales/pos-totals";
import { useI18n } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
import { type AppLocale, formatDate, formatMoney } from "@/lib/format";
import { sumPaymentsInSaleCurrency } from "@/lib/payment-totals";
import { isMudirDesktop } from "@/lib/runtime";
import { translateError } from "@/lib/translate-error";

const PRINT_STYLE_ID = "mudir-pos-print-style";
const RECEIPT_PRINT_CLASS = "mudir-pos-receipt-print";

interface CartLine {
  batchLabel?: string;
  batchPicks?: { batchId: string; quantity: number }[];
  key: string;
  name: string;
  productId: string;
  qty: number;
  unitPrice: number;
}

interface Receipt {
  change: number;
  createdAt?: string;
  currencyCode: "AFN" | "USD";
  discount: number;
  lines: {
    key: string;
    name: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  paid: number;
  saleId: string;
  subtotal: number;
  tax: number;
  total: number;
}

interface PaymentRow {
  amount: number;
  currencyCode: "AFN" | "USD";
  key: string;
  method: "cash" | "card";
}

function receiptFromSaleDetail(detail: SaleDetail): Receipt {
  const { sale, items } = detail;
  return {
    change: sale.change_amount,
    createdAt: sale.created_at,
    currencyCode: sale.currency_code as "AFN" | "USD",
    discount: sale.discount_amount,
    lines: items.map((item) => ({
      key: item.id,
      lineTotal: item.quantity * item.unit_price,
      name: item.product_name ?? item.product_id,
      qty: item.quantity,
      unitPrice: item.unit_price,
    })),
    paid: sale.paid_amount,
    saleId: sale.id,
    subtotal: sale.subtotal,
    tax: sale.tax_amount,
    total: sale.total_amount,
  };
}

interface ReceiptBodyProps {
  changeLabel: string;
  discountLabel: string;
  locale: AppLocale;
  paidLabel: string;
  receipt: Receipt;
  storeAddress?: string;
  storeName: string;
  storePhone?: string;
  subtotalLabel: string;
  taxLabel: string;
  thanksLabel: string;
  totalLabel: string;
}

function ReceiptBody({
  receipt,
  storeName,
  storeAddress,
  storePhone,
  locale,
  thanksLabel,
  subtotalLabel,
  discountLabel,
  taxLabel,
  totalLabel,
  paidLabel,
  changeLabel,
}: ReceiptBodyProps) {
  const { currencyCode } = receipt;
  return (
    <div className={`text-sm ${RECEIPT_PRINT_CLASS}`}>
      <div className="font-semibold">{storeName}</div>
      {storeAddress ? (
        <div className="text-xs opacity-80">{storeAddress}</div>
      ) : null}
      {storePhone ? (
        <div className="text-xs opacity-80">{storePhone}</div>
      ) : null}
      <div className="mt-1 text-xs opacity-80">{thanksLabel}</div>
      <div className="font-mono text-xs">{receipt.saleId}</div>
      {receipt.createdAt ? (
        <div className="text-muted-foreground text-xs">
          {formatDate(receipt.createdAt, locale)}
        </div>
      ) : null}
      <Table className="mt-3 text-xs">
        <TableBody>
          {receipt.lines.map((l) => (
            <TableRow key={l.key}>
              <TableCell className="py-1 pe-2">{l.name}</TableCell>
              <TableCell className="py-1">{l.qty}×</TableCell>
              <TableCell className="py-1 text-end">
                {formatMoney(l.lineTotal, currencyCode, locale)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-2 border-border border-t pt-2">
        <div className="flex justify-between">
          <span>{subtotalLabel}</span>
          <span>{formatMoney(receipt.subtotal, currencyCode, locale)}</span>
        </div>
        <div className="flex justify-between">
          <span>{discountLabel}</span>
          <span>{formatMoney(receipt.discount, currencyCode, locale)}</span>
        </div>
        <div className="flex justify-between">
          <span>{taxLabel}</span>
          <span>{formatMoney(receipt.tax, currencyCode, locale)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>{totalLabel}</span>
          <span>{formatMoney(receipt.total, currencyCode, locale)}</span>
        </div>
        <div className="flex justify-between">
          <span>{paidLabel}</span>
          <span>{formatMoney(receipt.paid, currencyCode, locale)}</span>
        </div>
        <div className="flex justify-between">
          <span>{changeLabel}</span>
          <span>{formatMoney(receipt.change, currencyCode, locale)}</span>
        </div>
      </div>
    </div>
  );
}

export function PosClient() {
  const { t, locale } = useI18n();
  const uid = useId();
  const scanId = `${uid}-scan`;
  const productPickId = `${uid}-pick`;
  const qtyId = `${uid}-qty`;
  const priceId = `${uid}-price`;
  const discId = `${uid}-disc`;
  const taxId = `${uid}-tax`;
  const customerIdField = `${uid}-customer`;

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pickProductId, setPickProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [lineQty, setLineQty] = useState(0);
  const [linePrice, setLinePrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);
  const [recent, setRecent] = useState<RecentSaleRow[]>([]);
  const [returnConfirmId, setReturnConfirmId] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [currency, setCurrency] = useState<"AFN" | "USD">("AFN");
  const [usdToAfnRate, setUsdToAfnRate] = useState(70);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    {
      amount: 0,
      currencyCode: "AFN",
      key: "pay-1",
      method: "cash",
    },
  ]);
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState<string | undefined>();
  const [storePhone, setStorePhone] = useState<string | undefined>();
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [saleDetail, setSaleDetail] =
    useState<Awaited<ReturnType<typeof getSaleDetail>>>(null);
  const [batchPickTarget, setBatchPickTarget] = useState<{
    price: number;
    product: ProductRow;
    qty: number;
  } | null>(null);

  const receiptLabels = useMemo(
    () => ({
      changeLabel: t("pos.changeAmount"),
      discountLabel: t("common.discount"),
      paidLabel: t("pos.paidAmount"),
      subtotalLabel: t("common.subtotal"),
      taxLabel: t("common.tax"),
      thanksLabel: t("pos.receipt.thanks"),
      totalLabel: t("common.total"),
    }),
    [t]
  );

  const refreshCatalog = useCallback(async () => {
    setError(null);
    try {
      const [p, r, settings, customerRows] = await Promise.all([
        listProducts(),
        listRecentSales(30),
        getBusinessSettings(),
        listCustomers(),
      ]);
      setProducts(p);
      setRecent(r);
      setCustomers(customerRows);
      setStoreName(settings.storeName);
      setStoreAddress(settings.address);
      setStorePhone(settings.phone);
      setUsdToAfnRate(settings.usdToAfnRate);
      setCurrency(settings.baseCurrency);
      setPaymentRows([
        {
          amount: 0,
          currencyCode: settings.baseCurrency,
          key: "pay-1",
          method: "cash",
        },
      ]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(translateError(t, message));
    }
  }, [t]);

  useEffect(() => {
    refreshCatalog().catch(() => undefined);
  }, [refreshCatalog]);

  useEffect(() => {
    if (!returnConfirmId) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setReturnConfirmId(null);
        setReturnError(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [returnConfirmId]);

  useEffect(() => {
    if (document.getElementById(PRINT_STYLE_ID)) {
      return;
    }
    const s = document.createElement("style");
    s.id = PRINT_STYLE_ID;
    s.textContent = `
@media print {
  @page { size: 80mm auto; margin: 4mm; }
  body * { visibility: hidden; }
  .${RECEIPT_PRINT_CLASS}, .${RECEIPT_PRINT_CLASS} * { visibility: visible; }
  .${RECEIPT_PRINT_CLASS} {
    position: absolute;
    left: 0;
    top: 0;
    width: 72mm;
    max-width: 72mm;
    padding: 0;
    font-size: 11px;
    line-height: 1.35;
  }
}`;
    document.head.appendChild(s);
  }, []);

  const { subtotal, total } = useMemo(
    () =>
      computePosTotals(
        cart.map((l) => ({ quantity: l.qty, unitPrice: l.unitPrice })),
        discount,
        tax
      ),
    [cart, discount, tax]
  );

  useEffect(() => {
    const p = products.find((x) => x.id === pickProductId);
    if (p) {
      setLinePrice(p.sale_price);
    }
  }, [pickProductId, products]);

  const addProductToCart = (
    p: ProductRow,
    qty: number,
    price: number,
    batchPicks?: { batchId: string; quantity: number }[],
    batchLabel?: string
  ) => {
    if (p.on_hand_qty < qty) {
      setError(t("validation.insufficientStock"));
      return false;
    }
    setCart((c) => [
      ...c,
      {
        batchLabel,
        batchPicks,
        key: crypto.randomUUID(),
        name: p.name,
        productId: p.id,
        qty,
        unitPrice: price,
      },
    ]);
    return true;
  };

  const queueProductForCart = (p: ProductRow, qty: number, price: number) => {
    if (p.tracking_mode === "serial") {
      if (qty !== 1) {
        setError(t("validation.serialQtyOne"));
        return;
      }
      setBatchPickTarget({ price, product: p, qty });
      return;
    }
    addProductToCart(p, qty, price);
  };

  const addLine = () => {
    setError(null);
    const p = products.find((x) => x.id === pickProductId);
    if (!p) {
      setError(t("validation.productRequired"));
      return;
    }
    if (lineQty < 1 || !Number.isInteger(lineQty)) {
      setError(t("validation.qtyMinZero"));
      return;
    }
    if (linePrice < 0 || Number.isNaN(linePrice)) {
      setError(t("validation.amountPositive"));
      return;
    }
    queueProductForCart(p, lineQty, linePrice);
    setPickProductId("");
    setLineQty(0);
    setLinePrice(0);
  };

  const scanAndAdd = async () => {
    const code = scanCode.trim();
    if (!code) {
      return;
    }
    const p = await findProductBySkuOrBarcode(code);
    if (!p) {
      setError(t("validation.productRequired"));
      return;
    }
    queueProductForCart(p, 1, p.sale_price);
    setScanCode("");
  };

  const removeLine = (key: string) => {
    setCart((c) => c.filter((l) => l.key !== key));
  };

  const updateLineQty = (key: string, qty: number) => {
    setCart((c) =>
      c.map((l) => (l.key === key ? { ...l, qty: Math.max(1, qty) } : l))
    );
  };

  const paidInSaleCurrency = useMemo(
    () =>
      sumPaymentsInSaleCurrency(
        paymentRows.map((row) => ({
          amount: row.amount,
          currencyCode: row.currencyCode,
          method: row.method,
        })),
        currency,
        usdToAfnRate
      ),
    [paymentRows, currency, usdToAfnRate]
  );

  const changeAmount = Math.max(0, paidInSaleCurrency - total);

  const submitSale = useCallback(async () => {
    setError(null);
    if (cart.length === 0) {
      setError(t("validation.cartEmpty"));
      return;
    }
    if (paidInSaleCurrency < total) {
      setError(t("validation.paidTooLow"));
      return;
    }
    setIsSubmitting(true);
    try {
      const { saleId } = await completePosSale(
        {
          ...(customerId ? { customerId } : {}),
          discountAmount: discount,
          items: cart.map((l) => ({
            batchPicks: l.batchPicks,
            productId: l.productId,
            quantity: l.qty,
            unitPrice: l.unitPrice,
          })),
          paidAmount: paidInSaleCurrency,
          taxAmount: tax,
        },
        {
          channel: "in_store",
          currencyCode: currency,
          exchangeRate: currency === "USD" ? usdToAfnRate : 1,
          payments: paymentRows.map((row) => ({
            amount: row.amount,
            currencyCode: row.currencyCode,
            method: row.method,
          })),
        }
      );
      const lines = cart.map((l) => ({
        key: l.key,
        lineTotal: l.qty * l.unitPrice,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
      }));
      setLastReceipt({
        change: changeAmount,
        createdAt: new Date().toISOString(),
        currencyCode: currency,
        discount,
        lines,
        paid: paidInSaleCurrency,
        saleId,
        subtotal,
        tax,
        total,
      });
      setCart([]);
      setCustomerId("");
      setPaymentRows([
        {
          amount: 0,
          currencyCode: currency,
          key: crypto.randomUUID(),
          method: "cash",
        },
      ]);
      await refreshCatalog();
      toastSuccess(t("pos.toast.saleComplete"));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toastTranslatedError(t, e);
      setError(translateError(t, message));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    cart,
    customerId,
    discount,
    tax,
    paidInSaleCurrency,
    total,
    subtotal,
    refreshCatalog,
    currency,
    usdToAfnRate,
    paymentRows,
    changeAmount,
    t,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") {
        return;
      }
      if (cart.length === 0 || isSubmitting || paidInSaleCurrency < total) {
        return;
      }
      e.preventDefault();
      submitSale().catch(() => undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [cart.length, isSubmitting, paidInSaleCurrency, total, submitSale]);

  const printReceipt = (receipt?: Receipt | null) => {
    if (receipt) {
      setLastReceipt(receipt);
      requestAnimationFrame(() => {
        window.print();
      });
      return;
    }
    window.print();
  };

  const pendingReturnSale = returnConfirmId
    ? recent.find((s) => s.id === returnConfirmId)
    : undefined;

  const confirmReturn = async () => {
    if (!returnConfirmId) {
      return;
    }
    setReturnError(null);
    setReturnSubmitting(true);
    try {
      await returnPosSale({
        originalSaleId: returnConfirmId,
      });
      setReturnConfirmId(null);
      await refreshCatalog();
      toastSuccess(t("pos.toast.returnComplete"));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toastTranslatedError(t, e);
      setReturnError(translateError(t, message));
    } finally {
      setReturnSubmitting(false);
    }
  };

  const displayStoreName = storeName || t("app.name");

  useModuleTour();

  return (
    <main className="mx-auto max-w-6xl px-6 pb-6">
      <PageHeader>
        <PageTitle href="/pos">{t("pos.title")}</PageTitle>
        <p className="mt-1 text-muted-foreground text-sm">
          {t("pos.subtitle")}{" "}
          <Badge className="font-mono font-normal" variant="outline">
            Ctrl+Enter
          </Badge>
        </p>
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

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setReturnConfirmId(null);
            setReturnError(null);
          }
        }}
        open={returnConfirmId !== null}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle id={`${uid}-return-title`}>
              {t("pos.return")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {t("pos.returnConfirm")}
          </p>
          {pendingReturnSale ? (
            <p className="font-mono text-xs opacity-80">
              {pendingReturnSale.id}
              <br />
              {t("common.total")}{" "}
              {formatMoney(
                Number(pendingReturnSale.total_amount),
                pendingReturnSale.currency_code as "AFN" | "USD",
                locale
              )}{" "}
              · {formatDate(pendingReturnSale.created_at, locale)}
            </p>
          ) : null}
          {returnError ? (
            <Alert variant="destructive">
              <AlertDescription>{returnError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              disabled={returnSubmitting}
              onClick={() => {
                setReturnConfirmId(null);
                setReturnError(null);
              }}
              type="button"
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button
              disabled={returnSubmitting || !isMudirDesktop()}
              onClick={() => {
                confirmReturn().catch(() => undefined);
              }}
              type="button"
              variant="destructive"
            >
              {returnSubmitting
                ? t("common.loading")
                : t("pos.returnConfirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card data-tour="pos-add-product">
            <CardHeader>
              <CardTitle>{t("pos.addProduct")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Field className="mb-4">
                <Label htmlFor={scanId}>{t("pos.scan")}</Label>
                <div className="flex gap-2">
                  <Input
                    id={scanId}
                    onChange={(e) => setScanCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        scanAndAdd().catch(() => undefined);
                      }
                    }}
                    value={scanCode}
                  />
                  <Button
                    data-icon="inline-start"
                    onClick={() => {
                      scanAndAdd().catch(() => undefined);
                    }}
                    type="button"
                  >
                    <Plus aria-hidden />
                    {t("common.add")}
                  </Button>
                </div>
              </Field>
              <div className="flex flex-wrap items-end gap-3">
                <Field className="min-w-48">
                  <Label htmlFor={productPickId}>{t("pos.pickProduct")}</Label>
                  <ProductCombobox
                    allowNone
                    id={productPickId}
                    onValueChange={setPickProductId}
                    products={products}
                    showStock
                    value={pickProductId}
                  />
                </Field>
                <Field className="w-24">
                  <Label htmlFor={qtyId}>{t("common.qty")}</Label>
                  <NumberInput
                    id={qtyId}
                    onValueChange={setLineQty}
                    step={1}
                    value={lineQty}
                  />
                </Field>
                <Field className="w-28">
                  <Label htmlFor={priceId}>{t("pos.unitPrice")}</Label>
                  <NumberInput
                    id={priceId}
                    onValueChange={setLinePrice}
                    step="any"
                    value={linePrice}
                  />
                </Field>
                <Button onClick={addLine} type="button">
                  {t("common.add")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("pos.cart")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[480px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("pos.pickProduct")}</TableHead>
                      <TableHead>{t("common.qty")}</TableHead>
                      <TableHead>{t("common.price")}</TableHead>
                      <TableHead>{t("common.lineTotal")}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.length === 0 ? (
                      <TableRow>
                        <TableCell
                          className="py-6 text-center text-muted-foreground"
                          colSpan={5}
                        >
                          {t("pos.cartEmpty")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      cart.map((l) => (
                        <TableRow key={l.key}>
                          <TableCell>
                            <div>{l.name}</div>
                            {l.batchLabel ? (
                              <div className="font-mono text-muted-foreground text-xs">
                                {l.batchLabel}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <NumberInput
                              className="w-16"
                              min={1}
                              onValueChange={(qty) => {
                                updateLineQty(l.key, qty > 0 ? qty : 1);
                              }}
                              step={1}
                              value={l.qty}
                            />
                          </TableCell>
                          <TableCell>
                            {formatMoney(l.unitPrice, currency, locale)}
                          </TableCell>
                          <TableCell>
                            {formatMoney(l.qty * l.unitPrice, currency, locale)}
                          </TableCell>
                          <TableCell>
                            <Button
                              className="h-auto px-0 text-destructive"
                              onClick={() => {
                                removeLine(l.key);
                              }}
                              size="sm"
                              type="button"
                              variant="link"
                            >
                              {t("common.delete")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("pos.totals")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid max-w-md gap-3 sm:grid-cols-2">
                <Field className="sm:col-span-2">
                  <Label htmlFor={customerIdField}>{t("pos.customer")}</Label>
                  <Select
                    onValueChange={(v) => {
                      setCustomerId(v === "__none__" ? "" : v);
                    }}
                    value={customerId || "__none__"}
                  >
                    <SelectTrigger id={customerIdField}>
                      <SelectValue placeholder={t("common.none")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        {t("common.none")}
                      </SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <Label htmlFor={discId}>{t("common.discount")}</Label>
                  <NumberInput
                    id={discId}
                    onValueChange={setDiscount}
                    step="any"
                    value={discount}
                  />
                </Field>
                <Field>
                  <Label htmlFor={taxId}>{t("common.tax")}</Label>
                  <NumberInput
                    id={taxId}
                    onValueChange={setTax}
                    step="any"
                    value={tax}
                  />
                </Field>
                <Field className="w-28">
                  <Label>{t("common.currency.afn")}</Label>
                  <Select
                    onValueChange={(v) => setCurrency(v as "AFN" | "USD")}
                    value={currency}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AFN">
                        {t("common.currency.afn")}
                      </SelectItem>
                      <SelectItem value="USD">
                        {t("common.currency.usd")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="sm:col-span-2">
                  <Label>{t("pos.payments")}</Label>
                  {paymentRows.map((row) => (
                    <div
                      className="flex flex-wrap items-end gap-2"
                      key={row.key}
                    >
                      <Select
                        onValueChange={(v) =>
                          setPaymentRows((rows) =>
                            rows.map((r) =>
                              r.key === row.key
                                ? { ...r, method: v as "cash" | "card" }
                                : r
                            )
                          )
                        }
                        value={row.method}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">
                            {t("pos.method.cash")}
                          </SelectItem>
                          <SelectItem value="card">
                            {t("pos.method.card")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        onValueChange={(v) =>
                          setPaymentRows((rows) =>
                            rows.map((r) =>
                              r.key === row.key
                                ? {
                                    ...r,
                                    currencyCode: v as "AFN" | "USD",
                                  }
                                : r
                            )
                          )
                        }
                        value={row.currencyCode}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AFN">
                            {t("common.currency.afn")}
                          </SelectItem>
                          <SelectItem value="USD">
                            {t("common.currency.usd")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <NumberInput
                        className="w-32"
                        onValueChange={(amount) =>
                          setPaymentRows((rows) =>
                            rows.map((r) =>
                              r.key === row.key ? { ...r, amount } : r
                            )
                          )
                        }
                        step="any"
                        value={row.amount}
                      />
                      <Button
                        className="h-auto px-0 text-destructive"
                        disabled={paymentRows.length <= 1}
                        onClick={() =>
                          setPaymentRows((rows) =>
                            rows.filter((r) => r.key !== row.key)
                          )
                        }
                        size="sm"
                        type="button"
                        variant="link"
                      >
                        {t("common.delete")}
                      </Button>
                    </div>
                  ))}
                  <Button
                    data-icon="inline-start"
                    onClick={() =>
                      setPaymentRows((rows) => [
                        ...rows,
                        {
                          amount: 0,
                          currencyCode: currency,
                          key: crypto.randomUUID(),
                          method: "cash",
                        },
                      ])
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus aria-hidden />
                    {t("pos.addPayment")}
                  </Button>
                </Field>
              </div>
              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt>{t("common.subtotal")}</dt>
                  <dd>{formatMoney(subtotal, currency, locale)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t("common.total")}</dt>
                  <dd className="font-medium">
                    {formatMoney(total, currency, locale)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t("pos.paidTotal")}</dt>
                  <dd>{formatMoney(paidInSaleCurrency, currency, locale)}</dd>
                </div>
                {paidInSaleCurrency >= total ? (
                  <div className="flex justify-between text-primary">
                    <dt>{t("pos.change")}</dt>
                    <dd>{formatMoney(changeAmount, currency, locale)}</dd>
                  </div>
                ) : null}
              </dl>
              <Button
                className="mt-4"
                data-icon="inline-start"
                data-tour="pos-complete"
                disabled={
                  cart.length === 0 ||
                  isSubmitting ||
                  paidInSaleCurrency < total ||
                  !isMudirDesktop()
                }
                onClick={() => {
                  submitSale().catch(() => undefined);
                }}
                type="button"
              >
                <Check aria-hidden />
                {isSubmitting ? t("common.loading") : t("pos.complete")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("pos.recentSales")}</CardTitle>
            </CardHeader>
            <CardContent className="max-h-64 space-y-2 overflow-y-auto p-0 pt-0">
              {recent.length === 0 ? (
                <p className="px-4 pb-4 text-muted-foreground text-sm">
                  {t("common.empty")}
                </p>
              ) : (
                recent.map((s) => (
                  <Card className="mx-4 mb-2 shadow-none" key={s.id}>
                    <CardContent className="p-3">
                      <div className="font-mono text-xs opacity-70">
                        {s.id.slice(0, 12)}…
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>{t("common.total")}</span>
                        <span>
                          {formatMoney(
                            Number(s.total_amount),
                            s.currency_code as "AFN" | "USD",
                            locale
                          )}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {formatDate(s.created_at, locale)}
                      </div>
                      <Button
                        className="h-auto px-0"
                        onClick={() => {
                          getSaleDetail(s.id)
                            .then((d) => {
                              setSaleDetail(d);
                              setDetailSaleId(s.id);
                            })
                            .catch(() => undefined);
                        }}
                        size="sm"
                        type="button"
                        variant="link"
                      >
                        {t("common.view")}
                      </Button>
                      {s.returned_at ? (
                        <Badge className="mt-1" variant="secondary">
                          {t("pos.returned")}
                        </Badge>
                      ) : (
                        <Button
                          className="mt-2 h-auto px-0 text-destructive"
                          disabled={!isMudirDesktop()}
                          onClick={() => {
                            setReturnError(null);
                            setReturnConfirmId(s.id);
                          }}
                          size="sm"
                          type="button"
                          variant="link"
                        >
                          {t("pos.return")}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {lastReceipt ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>{t("pos.lastReceipt")}</CardTitle>
                <Button
                  data-icon="inline-start"
                  onClick={() => {
                    printReceipt();
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Printer aria-hidden />
                  {t("common.print")}
                </Button>
              </CardHeader>
              <CardContent>
                <ReceiptBody
                  locale={locale}
                  receipt={lastReceipt}
                  storeAddress={storeAddress}
                  storeName={displayStoreName}
                  storePhone={storePhone}
                  {...receiptLabels}
                />
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDetailSaleId(null);
          }
        }}
        open={detailSaleId !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pos.detail")}</DialogTitle>
          </DialogHeader>
          {saleDetail?.items.map((item) => (
            <div className="flex justify-between text-sm" key={item.id}>
              <span>{item.product_name ?? item.product_id}</span>
              <span>
                {item.quantity} ×{" "}
                {formatMoney(
                  item.unit_price,
                  saleDetail.sale.currency_code as "AFN" | "USD",
                  locale
                )}
              </span>
            </div>
          ))}
          {saleDetail ? (
            <p className="font-medium">
              {formatMoney(
                saleDetail.sale.total_amount,
                saleDetail.sale.currency_code as "AFN" | "USD",
                locale
              )}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              data-icon="inline-start"
              onClick={() => {
                if (saleDetail) {
                  printReceipt(receiptFromSaleDetail(saleDetail));
                }
              }}
              type="button"
            >
              <Printer aria-hidden />
              {t("pos.reprint")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BatchPickerDialog
        onClose={() => setBatchPickTarget(null)}
        onSelect={(batch) => {
          if (!batchPickTarget) {
            return;
          }
          const label =
            batch.serial_number ?? batch.lot_number ?? batch.id.slice(0, 8);
          addProductToCart(
            batchPickTarget.product,
            batchPickTarget.qty,
            batchPickTarget.price,
            [{ batchId: batch.id, quantity: batchPickTarget.qty }],
            label
          );
          setBatchPickTarget(null);
        }}
        open={batchPickTarget !== null}
        productId={batchPickTarget?.product.id ?? ""}
        productName={batchPickTarget?.product.name ?? ""}
        trackingMode={batchPickTarget?.product.tracking_mode ?? "serial"}
      />
    </main>
  );
}
