"use client";

import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useId, useState } from "react";
import { pingDataLayer } from "@/bridge/ping";
import {
  listProducts,
  type ProductRow,
  seedDevProductsIfEmpty,
} from "@/bridge/products";
import { DashboardCharts } from "./dashboard-charts";

export default function DashboardPage() {
  const productsSectionId = useId();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [ping, setPing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const rows = await listProducts();
      setProducts(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const p = await pingDataLayer();
        if (!cancelled) {
          setPing(
            p
              ? `${p.message} (${p.ok ? "ok" : "fail"})`
              : "Web preview — Tauri off",
          );
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
      if (!cancelled) {
        await refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const onSeed = async () => {
    setBusy(true);
    setError(null);
    try {
      const { seeded } = await seedDevProductsIfEmpty();
      if (seeded > 0) {
        setPing(`Seeded ${seeded} demo products`);
      }
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="font-semibold text-2xl tracking-tight">Dashboard</h1>
      <p className="mt-1 text-neutral-600 text-sm dark:text-neutral-400">
        Data layer: SQLite via{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
          tauri-plugin-sql
        </code>
        ; validation with Zod on the TypeScript bridge.
      </p>

      {ping ? (
        <p className="mt-3 text-neutral-500 text-xs dark:text-neutral-500">
          Bridge: {ping}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-red-600 text-sm dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !isTauri()}
          onClick={() => {
            void onSeed();
          }}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Seed demo products (if empty)
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void refresh();
          }}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
        >
          Refresh list
        </button>
      </div>

      {!isTauri() ? (
        <p className="mt-4 text-amber-800 text-sm dark:text-amber-200">
          Run{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
            pnpm tauri dev
          </code>{" "}
          to load SQLite and invoke commands.
        </p>
      ) : null}

      <section className="mt-8" aria-labelledby={productsSectionId}>
        <h2 className="font-medium text-lg" id={productsSectionId}>
          Products ({products.length})
        </h2>
        <ul className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {products.length === 0 ? (
            <li className="px-3 py-6 text-neutral-500 text-sm">
              No rows yet. Seed demo data or add products (coming in next
              phase).
            </li>
          ) : (
            products.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-neutral-500 text-xs">
                  qty {p.on_hand_qty}
                  {p.sku ? ` · ${p.sku}` : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <DashboardCharts />
    </main>
  );
}
