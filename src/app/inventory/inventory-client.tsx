"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  applyStockMovement,
  listStockMovements,
  type StockMovementListRow,
} from "@/bridge/inventory";
import { listProducts, type ProductRow } from "@/bridge/products";
import {
  formValuesToDelta,
  type InventoryFormValues,
  inventoryFormSchema,
} from "@/domain/inventory/schemas";

export function InventoryClient() {
  const uid = useId();
  const recordHeadingId = `${uid}-record`;
  const historyHeadingId = `${uid}-history`;
  const productFieldId = `${uid}-product`;
  const adjFieldId = `${uid}-adj`;
  const qtyFieldId = `${uid}-qty`;

  const [movements, setMovements] = useState<StockMovementListRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

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
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InventoryFormValues>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      productId: "",
      movementType: "purchase",
      qty: 1,
      adjustmentDelta: undefined,
    },
  });

  const movementType = watch("movementType");

  const onSubmit = handleSubmit(async (values) => {
    setLoadError(null);
    const delta = formValuesToDelta(values);
    const refId = `inv-${crypto.randomUUID()}`;
    try {
      await applyStockMovement({
        product_id: values.productId,
        type: values.movementType,
        quantity_delta: delta,
        ref_id: refId,
      });
      reset({
        productId: values.productId,
        movementType: values.movementType,
        qty: 1,
        adjustmentDelta: undefined,
      });
      await refresh();
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  });

  const columns = useMemo<ColumnDef<StockMovementListRow>[]>(
    () => [
      { accessorKey: "created_at", header: "When", sortingFn: "alphanumeric" },
      {
        accessorKey: "product_name",
        header: "Product",
        cell: ({ row }) =>
          row.original.product_name ?? row.original.product_id.slice(0, 8),
      },
      { accessorKey: "type", header: "Type" },
      { accessorKey: "quantity_delta", header: "Δ Qty" },
      {
        accessorKey: "ref_id",
        header: "Ref",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue() as string}</span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: movements,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="font-semibold text-2xl tracking-tight">Inventory</h1>
      <p className="mt-1 text-neutral-600 text-sm dark:text-neutral-400">
        Record stock movements; on-hand is updated in a SQLite transaction
        (BEGIN … COMMIT).
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

      {loadError ? (
        <p className="mt-4 text-red-600 text-sm" role="alert">
          {loadError}
        </p>
      ) : null}

      <section
        aria-labelledby={recordHeadingId}
        className="mt-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
      >
        <h2 className="font-medium text-lg" id={recordHeadingId}>
          Record movement
        </h2>
        <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1">
            <label
              className="text-neutral-600 text-xs dark:text-neutral-400"
              htmlFor={productFieldId}
            >
              Product
            </label>
            <select
              id={productFieldId}
              className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
              {...register("productId")}
            >
              <option value="">Select…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (on hand: {p.on_hand_qty})
                </option>
              ))}
            </select>
            {errors.productId ? (
              <span className="text-red-600 text-xs">
                {errors.productId.message}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-neutral-600 text-xs dark:text-neutral-400">
              Movement type
            </span>
            <Controller
              control={control}
              name="movementType"
              render={({ field }) => (
                <div className="flex flex-wrap gap-3 text-sm">
                  {(
                    [
                      ["purchase", "Purchase (in)"],
                      ["return", "Return (in)"],
                      ["sale", "Sale (out)"],
                      ["adjustment", "Adjustment (±)"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className="inline-flex cursor-pointer items-center gap-1.5"
                    >
                      <input
                        type="radio"
                        value={value}
                        checked={field.value === value}
                        onChange={() => {
                          field.onChange(value);
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            />
          </div>

          {movementType === "adjustment" ? (
            <div className="flex flex-col gap-1">
              <label
                className="text-neutral-600 text-xs dark:text-neutral-400"
                htmlFor={adjFieldId}
              >
                Adjustment (negative removes stock)
              </label>
              <input
                id={adjFieldId}
                type="number"
                step={1}
                className="max-w-xs rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
                {...register("adjustmentDelta", { valueAsNumber: true })}
              />
              {errors.adjustmentDelta ? (
                <span className="text-red-600 text-xs">
                  {errors.adjustmentDelta.message}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label
                className="text-neutral-600 text-xs dark:text-neutral-400"
                htmlFor={qtyFieldId}
              >
                Quantity
              </label>
              <input
                id={qtyFieldId}
                type="number"
                min={1}
                step={1}
                className="max-w-xs rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
                {...register("qty", { valueAsNumber: true })}
              />
              {errors.qty ? (
                <span className="text-red-600 text-xs">
                  {errors.qty.message}
                </span>
              ) : null}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting || products.length === 0}
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {isSubmitting ? "Saving…" : "Apply movement"}
            </button>
            <button
              type="button"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
              onClick={() => {
                void refresh();
              }}
            >
              Refresh
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10" aria-labelledby={historyHeadingId}>
        <h2 className="font-medium text-lg" id={historyHeadingId}>
          Recent movements
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="border-neutral-200 border-b bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-3 py-2 font-medium">
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="inline-flex cursor-pointer select-none items-center gap-1"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {header.column.getIsSorted() === "asc" ? " ▲" : null}
                          {header.column.getIsSorted() === "desc" ? " ▼" : null}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-8 text-center text-neutral-500"
                    colSpan={columns.length}
                  >
                    No movements yet.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-neutral-100 border-b dark:border-neutral-900"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2">
                        {cell.column.id === "created_at"
                          ? (() => {
                              try {
                                return new Date(
                                  cell.getValue() as string,
                                ).toLocaleString();
                              } catch {
                                return String(cell.getValue());
                              }
                            })()
                          : flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
