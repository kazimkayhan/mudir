"use client";

import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useId, useState } from "react";
import { listProducts, type ProductRow } from "@/bridge/products";
import {
  listPurchases,
  type PurchaseRow,
  recordPurchase,
} from "@/bridge/purchases";
import {
  insertSupplier,
  listSuppliers,
  type SupplierRow,
} from "@/bridge/suppliers";

const DEV_CASHIER_ID = "dev-cashier";

type DraftLine = {
  key: string;
  productId: string;
  qty: number;
  unitCost: number;
};

export function PurchasesClient() {
  const uid = useId();
  const supNameId = `${uid}-sup-name`;
  const supPhoneId = `${uid}-sup-phone`;
  const refId = `${uid}-ref`;
  const notesId = `${uid}-notes`;

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pickProduct, setPickProduct] = useState("");
  const [lineQty, setLineQty] = useState(1);
  const [lineCost, setLineCost] = useState(0);
  const [newSupName, setNewSupName] = useState("");
  const [newSupPhone, setNewSupPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addLine = () => {
    setError(null);
    if (!pickProduct) {
      setError("Select a product.");
      return;
    }
    if (lineQty < 1 || !Number.isInteger(lineQty)) {
      setError("Quantity must be a positive integer.");
      return;
    }
    if (lineCost < 0 || Number.isNaN(lineCost)) {
      setError("Unit cost must be zero or greater.");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        productId: pickProduct,
        qty: lineQty,
        unitCost: lineCost,
      },
    ]);
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
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
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const submitPurchase = async () => {
    setError(null);
    if (lines.length === 0) {
      setError("Add at least one line.");
      return;
    }
    setBusy(true);
    try {
      await recordPurchase({
        cashierId: DEV_CASHIER_ID,
        supplierId: supplierId || undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.qty,
          unitCost: l.unitCost,
        })),
      });
      setLines([]);
      setReference("");
      setNotes("");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="font-semibold text-2xl tracking-tight">Purchases</h1>
      <p className="mt-1 text-neutral-600 text-sm dark:text-neutral-400">
        Suppliers, purchase receipts, and stock in via{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
          purchase
        </code>{" "}
        movements.
      </p>

      {!isTauri() ? (
        <p className="mt-4 text-amber-800 text-sm dark:text-amber-200">
          Run{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
            pnpm tauri dev
          </code>{" "}
          for SQLite.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-red-600 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <section className="mt-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="font-medium text-lg">New supplier</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex min-w-[10rem] flex-col gap-1">
            <label
              className="text-neutral-600 text-xs dark:text-neutral-400"
              htmlFor={supNameId}
            >
              Name
            </label>
            <input
              id={supNameId}
              className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
              value={newSupName}
              onChange={(e) => {
                setNewSupName(e.target.value);
              }}
            />
          </div>
          <div className="flex min-w-[8rem] flex-col gap-1">
            <label
              className="text-neutral-600 text-xs dark:text-neutral-400"
              htmlFor={supPhoneId}
            >
              Phone
            </label>
            <input
              id={supPhoneId}
              className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
              value={newSupPhone}
              onChange={(e) => {
                setNewSupPhone(e.target.value);
              }}
            />
          </div>
          <button
            type="button"
            disabled={busy || !newSupName.trim() || !isTauri()}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            onClick={() => {
              void addSupplier();
            }}
          >
            Save supplier
          </button>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="font-medium text-lg">Record purchase</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-neutral-600 text-xs dark:text-neutral-400">
              Supplier (optional)
            </span>
            <select
              className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
              }}
            >
              <option value="">— None —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-neutral-600 text-xs dark:text-neutral-400"
              htmlFor={refId}
            >
              Reference
            </label>
            <input
              id={refId}
              className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label
              className="text-neutral-600 text-xs dark:text-neutral-400"
              htmlFor={notesId}
            >
              Notes
            </label>
            <input
              id={notesId}
              className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
              }}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3 border-neutral-200 border-t pt-4 dark:border-neutral-700">
          <select
            className="min-w-[12rem] rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
            value={pickProduct}
            onChange={(e) => {
              setPickProduct(e.target.value);
            }}
          >
            <option value="">Product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            step={1}
            className="w-20 rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
            value={lineQty}
            onChange={(e) => {
              setLineQty(Number.parseInt(e.target.value, 10) || 1);
            }}
            aria-label="Quantity"
          />
          <input
            type="number"
            min={0}
            step="any"
            className="w-28 rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
            value={lineCost}
            onChange={(e) => {
              setLineCost(Number.parseFloat(e.target.value) || 0);
            }}
            aria-label="Unit cost"
          />
          <button
            type="button"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
            onClick={addLine}
          >
            Add line
          </button>
        </div>

        <ul className="mt-4 space-y-2 text-sm">
          {lines.length === 0 ? (
            <li className="text-neutral-500">No lines yet.</li>
          ) : (
            lines.map((l) => {
              const name =
                products.find((p) => p.id === l.productId)?.name ?? l.productId;
              return (
                <li
                  key={l.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-200 px-3 py-2 dark:border-neutral-800"
                >
                  <span>
                    {name} · {l.qty} × {l.unitCost} ={" "}
                    {(l.qty * l.unitCost).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    className="text-red-600 text-xs underline"
                    onClick={() => {
                      removeLine(l.key);
                    }}
                  >
                    Remove
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <button
          type="button"
          disabled={busy || lines.length === 0 || !isTauri()}
          className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          onClick={() => {
            void submitPurchase();
          }}
        >
          {busy ? "Saving…" : "Post purchase"}
        </button>
      </section>

      <section className="mt-10">
        <h2 className="font-medium text-lg">Recent purchases</h2>
        <ul className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {purchases.length === 0 ? (
            <li className="px-3 py-6 text-neutral-500 text-sm">None yet.</li>
          ) : (
            purchases.map((p) => (
              <li key={p.id} className="px-3 py-2 text-sm">
                <div className="font-mono text-xs opacity-70">
                  {p.id.slice(0, 10)}…
                </div>
                <div className="flex justify-between">
                  <span>Total cost</span>
                  <span>{Number(p.total_cost).toFixed(2)}</span>
                </div>
                <div className="text-neutral-500 text-xs">
                  {new Date(p.created_at).toLocaleString()}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
