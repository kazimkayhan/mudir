"use client";

import { isTauri } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { listProducts, type ProductRow } from "@/bridge/products";
import {
  completePosSale,
  listRecentSales,
  type RecentSaleRow,
  returnPosSale,
} from "@/bridge/sales";
import { computePosTotals } from "@/domain/sales/pos-totals";

const DEV_CASHIER_ID = "dev-cashier";
const PRINT_STYLE_ID = "mudir-pos-print-style";
const RECEIPT_PRINT_CLASS = "mudir-pos-receipt-print";

type CartLine = {
  key: string;
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
};

type Receipt = {
  saleId: string;
  lines: {
    key: string;
    name: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  change: number;
};

export function PosClient() {
  const uid = useId();
  const productPickId = `${uid}-pick`;
  const qtyId = `${uid}-qty`;
  const priceId = `${uid}-price`;
  const discId = `${uid}-disc`;
  const taxId = `${uid}-tax`;
  const paidId = `${uid}-paid`;

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pickProductId, setPickProductId] = useState("");
  const [lineQty, setLineQty] = useState(1);
  const [linePrice, setLinePrice] = useState(100);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paid, setPaid] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);
  const [recent, setRecent] = useState<RecentSaleRow[]>([]);
  const [returnConfirmId, setReturnConfirmId] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const refreshCatalog = useCallback(async () => {
    setError(null);
    try {
      const [p, r] = await Promise.all([listProducts(), listRecentSales(30)]);
      setProducts(p);
      setRecent(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();
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
  body * { visibility: hidden; }
  .${RECEIPT_PRINT_CLASS}, .${RECEIPT_PRINT_CLASS} * { visibility: visible; }
  .${RECEIPT_PRINT_CLASS} { position: absolute; left: 0; top: 0; width: 100%; padding: 1rem; }
}`;
    document.head.appendChild(s);
  }, []);

  const { subtotal, total } = useMemo(
    () =>
      computePosTotals(
        cart.map((l) => ({ quantity: l.qty, unitPrice: l.unitPrice })),
        discount,
        tax,
      ),
    [cart, discount, tax],
  );
  const changePreview = paid - total;

  const addLine = () => {
    setError(null);
    const p = products.find((x) => x.id === pickProductId);
    if (!p) {
      setError("Choose a product.");
      return;
    }
    if (lineQty < 1 || !Number.isInteger(lineQty)) {
      setError("Quantity must be a positive integer.");
      return;
    }
    if (linePrice < 0 || Number.isNaN(linePrice)) {
      setError("Unit price must be zero or greater.");
      return;
    }
    setCart((c) => [
      ...c,
      {
        key: crypto.randomUUID(),
        productId: p.id,
        name: p.name,
        qty: lineQty,
        unitPrice: linePrice,
      },
    ]);
  };

  const removeLine = (key: string) => {
    setCart((c) => c.filter((l) => l.key !== key));
  };

  const updateLineQty = (key: string, qty: number) => {
    setCart((c) =>
      c.map((l) => (l.key === key ? { ...l, qty: Math.max(1, qty) } : l)),
    );
  };

  const submitSale = useCallback(async () => {
    setError(null);
    if (cart.length === 0) {
      setError("Cart is empty.");
      return;
    }
    if (paid < total) {
      setError("Paid amount is less than total.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { saleId } = await completePosSale({
        cashierId: DEV_CASHIER_ID,
        discountAmount: discount,
        taxAmount: tax,
        paidAmount: paid,
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.qty,
          unitPrice: l.unitPrice,
        })),
      });
      const lines = cart.map((l) => ({
        key: l.key,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: l.qty * l.unitPrice,
      }));
      setLastReceipt({
        saleId,
        lines,
        subtotal,
        discount,
        tax,
        total,
        paid,
        change: paid - total,
      });
      setCart([]);
      setPaid(0);
      await refreshCatalog();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }, [cart, discount, tax, paid, total, subtotal, refreshCatalog]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") {
        return;
      }
      if (cart.length === 0 || isSubmitting || paid < total) {
        return;
      }
      e.preventDefault();
      void submitSale();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [cart.length, isSubmitting, paid, total, submitSale]);

  const printReceipt = () => {
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
        cashierId: DEV_CASHIER_ID,
      });
      setReturnConfirmId(null);
      await refreshCatalog();
    } catch (e: unknown) {
      setReturnError(e instanceof Error ? e.message : String(e));
    } finally {
      setReturnSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="font-semibold text-2xl tracking-tight">POS</h1>
      <p className="mt-1 text-neutral-600 text-sm dark:text-neutral-400">
        Cart, discount, tax, and payment. Complete with the button or{" "}
        <kbd className="rounded border border-neutral-300 px-1 text-xs dark:border-neutral-600">
          Ctrl+Enter
        </kbd>{" "}
        when paid covers total.
      </p>

      {!isTauri() ? (
        <p className="mt-4 text-amber-800 text-sm dark:text-amber-200">
          Run{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
            pnpm tauri dev
          </code>{" "}
          for the database.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-red-600 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <AnimatePresence>
        {returnConfirmId ? (
          <motion.div
            key="return-overlay"
            role="presentation"
            aria-hidden
            className="fixed inset-0 z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => {
              setReturnConfirmId(null);
              setReturnError(null);
            }}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {returnConfirmId ? (
          <div
            key="return-dialog-wrap"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${uid}-return-title`}
              className="pointer-events-auto w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-700 dark:bg-neutral-950"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <h2 className="font-semibold text-lg" id={`${uid}-return-title`}>
                Return entire sale?
              </h2>
              <p className="mt-2 text-neutral-600 text-sm dark:text-neutral-400">
                Stock will be increased for each line. This cannot be undone
                from the POS screen.
              </p>
              {pendingReturnSale ? (
                <p className="mt-3 font-mono text-xs opacity-80">
                  {pendingReturnSale.id}
                  <br />
                  Total {Number(pendingReturnSale.total_amount).toFixed(2)} ·{" "}
                  {new Date(pendingReturnSale.created_at).toLocaleString()}
                </p>
              ) : null}
              {returnError ? (
                <p className="mt-3 text-red-600 text-sm" role="alert">
                  {returnError}
                </p>
              ) : null}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
                  disabled={returnSubmitting}
                  onClick={() => {
                    setReturnConfirmId(null);
                    setReturnError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                  disabled={returnSubmitting || !isTauri()}
                  onClick={() => {
                    void confirmReturn();
                  }}
                >
                  {returnSubmitting ? "Working…" : "Confirm return"}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section
            aria-label="Add line"
            className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <h2 className="font-medium text-lg">Add to cart</h2>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="flex min-w-[12rem] flex-col gap-1">
                <label
                  className="text-neutral-600 text-xs dark:text-neutral-400"
                  htmlFor={productPickId}
                >
                  Product
                </label>
                <select
                  id={productPickId}
                  className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
                  value={pickProductId}
                  onChange={(e) => {
                    setPickProductId(e.target.value);
                  }}
                >
                  <option value="">Select…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (stock {p.on_hand_qty})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex w-24 flex-col gap-1">
                <label
                  className="text-neutral-600 text-xs dark:text-neutral-400"
                  htmlFor={qtyId}
                >
                  Qty
                </label>
                <input
                  id={qtyId}
                  type="number"
                  min={1}
                  step={1}
                  className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
                  value={lineQty}
                  onChange={(e) => {
                    setLineQty(Number.parseInt(e.target.value, 10) || 1);
                  }}
                />
              </div>
              <div className="flex w-28 flex-col gap-1">
                <label
                  className="text-neutral-600 text-xs dark:text-neutral-400"
                  htmlFor={priceId}
                >
                  Unit price
                </label>
                <input
                  id={priceId}
                  type="number"
                  min={0}
                  step="any"
                  className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
                  value={linePrice}
                  onChange={(e) => {
                    setLinePrice(Number.parseFloat(e.target.value) || 0);
                  }}
                />
              </div>
              <button
                type="button"
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
                onClick={addLine}
              >
                Add
              </button>
            </div>
          </section>

          <section aria-label="Cart">
            <h2 className="font-medium text-lg">Cart</h2>
            <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead className="border-neutral-200 border-b bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
                  <tr>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Line</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-neutral-500"
                        colSpan={5}
                      >
                        No lines yet.
                      </td>
                    </tr>
                  ) : (
                    cart.map((l) => (
                      <tr
                        key={l.key}
                        className="border-neutral-100 border-b dark:border-neutral-900"
                      >
                        <td className="px-3 py-2">{l.name}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            className="w-16 rounded border border-neutral-300 px-1 py-1 dark:border-neutral-600"
                            value={l.qty}
                            onChange={(e) => {
                              updateLineQty(
                                l.key,
                                Number.parseInt(e.target.value, 10) || 1,
                              );
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">{l.unitPrice}</td>
                        <td className="px-3 py-2">
                          {(l.qty * l.unitPrice).toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="text-red-600 text-xs underline"
                            onClick={() => {
                              removeLine(l.key);
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            aria-label="Totals and payment"
            className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="grid max-w-md gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label
                  className="text-neutral-600 text-xs dark:text-neutral-400"
                  htmlFor={discId}
                >
                  Discount
                </label>
                <input
                  id={discId}
                  type="number"
                  min={0}
                  step="any"
                  className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
                  value={discount}
                  onChange={(e) => {
                    setDiscount(Number.parseFloat(e.target.value) || 0);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-neutral-600 text-xs dark:text-neutral-400"
                  htmlFor={taxId}
                >
                  Tax
                </label>
                <input
                  id={taxId}
                  type="number"
                  min={0}
                  step="any"
                  className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
                  value={tax}
                  onChange={(e) => {
                    setTax(Number.parseFloat(e.target.value) || 0);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label
                  className="text-neutral-600 text-xs dark:text-neutral-400"
                  htmlFor={paidId}
                >
                  Paid
                </label>
                <input
                  id={paidId}
                  type="number"
                  min={0}
                  step="any"
                  className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
                  value={paid}
                  onChange={(e) => {
                    setPaid(Number.parseFloat(e.target.value) || 0);
                  }}
                />
              </div>
            </div>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{subtotal.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Total</dt>
                <dd className="font-medium">{total.toFixed(2)}</dd>
              </div>
              {paid >= total ? (
                <div className="flex justify-between text-green-700 dark:text-green-400">
                  <dt>Change</dt>
                  <dd>{changePreview.toFixed(2)}</dd>
                </div>
              ) : null}
            </dl>
            <button
              type="button"
              disabled={
                cart.length === 0 || isSubmitting || paid < total || !isTauri()
              }
              className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              onClick={() => {
                void submitSale();
              }}
            >
              {isSubmitting ? "Saving…" : "Complete sale"}
            </button>
          </section>
        </div>

        <aside className="space-y-6">
          <section aria-label="Recent sales">
            <h2 className="font-medium text-lg">Recent sales</h2>
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm">
              {recent.length === 0 ? (
                <li className="text-neutral-500">No sales yet.</li>
              ) : (
                recent.map((s) => (
                  <li
                    key={s.id}
                    className="rounded border border-neutral-200 px-2 py-2 dark:border-neutral-800"
                  >
                    <div className="font-mono text-xs opacity-70">
                      {s.id.slice(0, 12)}…
                    </div>
                    <div className="flex justify-between">
                      <span>Total</span>
                      <span>{Number(s.total_amount).toFixed(2)}</span>
                    </div>
                    <div className="text-neutral-500 text-xs">
                      {new Date(s.created_at).toLocaleString()}
                    </div>
                    {s.returned_at ? (
                      <div className="mt-1 text-amber-800 text-xs dark:text-amber-200">
                        Returned
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mt-2 text-red-700 text-xs underline dark:text-red-400"
                        disabled={!isTauri()}
                        onClick={() => {
                          setReturnError(null);
                          setReturnConfirmId(s.id);
                        }}
                      >
                        Return sale
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
          </section>

          {lastReceipt ? (
            <section aria-label="Last receipt">
              <h2 className="font-medium text-lg">Last receipt</h2>
              <button
                type="button"
                className="mt-2 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
                onClick={printReceipt}
              >
                Print
              </button>
              <div
                className={`mt-4 rounded border border-neutral-200 p-4 text-sm dark:border-neutral-800 ${RECEIPT_PRINT_CLASS}`}
              >
                <div className="font-semibold">Mudir</div>
                <div className="font-mono text-xs">{lastReceipt.saleId}</div>
                <table className="mt-3 w-full text-left text-xs">
                  <tbody>
                    {lastReceipt.lines.map((l) => (
                      <tr key={l.key}>
                        <td className="py-1 pr-2">{l.name}</td>
                        <td className="py-1">{l.qty}×</td>
                        <td className="py-1 text-right">
                          {l.lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 border-neutral-200 border-t pt-2 dark:border-neutral-700">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{lastReceipt.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span>{lastReceipt.discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>{lastReceipt.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span>{lastReceipt.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paid</span>
                    <span>{lastReceipt.paid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Change</span>
                    <span>{lastReceipt.change.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
