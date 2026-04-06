"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteProductById,
  listProducts,
  type ProductRow,
} from "@/bridge/products";
import { ProductEditorDialog } from "./ProductEditorDialog";

export function ProductsClient() {
  const [data, setData] = useState<ProductRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editRow, setEditRow] = useState<ProductRow | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const rows = await listProducts();
      setData(rows);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (q.length === 0) {
      return data;
    }
    return data.filter((p) => {
      const sku = p.sku?.toLowerCase() ?? "";
      return (
        p.name.toLowerCase().includes(q) ||
        sku.includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    });
  }, [data, filter]);

  const columns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v && v.length > 0 ? v : "—";
        },
      },
      {
        accessorKey: "on_hand_qty",
        header: "Qty",
      },
      {
        accessorKey: "created_at",
        header: "Created",
        sortingFn: "alphanumeric",
        cell: ({ getValue }) => {
          const v = getValue() as string;
          try {
            return new Date(v).toLocaleString();
          } catch {
            return v;
          }
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="text-neutral-700 text-xs underline dark:text-neutral-300"
              onClick={() => {
                setEditorMode("edit");
                setEditRow(row.original);
                setEditorOpen(true);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="text-red-700 text-xs underline dark:text-red-400"
              onClick={() => {
                void (async () => {
                  const ok = globalThis.confirm(
                    `Delete “${row.original.name}”? This cannot be undone.`,
                  );
                  if (!ok) {
                    return;
                  }
                  try {
                    await deleteProductById(row.original.id);
                    await refresh();
                  } catch (e: unknown) {
                    globalThis.alert(
                      e instanceof Error ? e.message : String(e),
                    );
                  }
                })();
              }}
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    [refresh],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Products</h1>
          <p className="mt-1 text-neutral-600 text-sm dark:text-neutral-400">
            TanStack Table (sortable columns) + React Hook Form + Zod. Data:
            SQLite via Tauri SQL plugin.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
          onClick={() => {
            setEditorMode("create");
            setEditRow(null);
            setEditorOpen(true);
          }}
        >
          Add product
        </button>
      </div>

      {!isTauri() ? (
        <p className="mt-4 text-amber-800 text-sm dark:text-amber-200">
          Run{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
            pnpm tauri dev
          </code>{" "}
          to use the local database.
        </p>
      ) : null}

      {loadError ? (
        <p className="mt-4 text-red-600 text-sm" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex max-w-md flex-1 flex-col gap-1 text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">Filter</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
            }}
            placeholder="Name, SKU, or id…"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
          />
        </label>
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
                  No products. Add one or seed from the dashboard.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-neutral-100 border-b dark:border-neutral-900"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-top">
                      {flexRender(
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

      <ProductEditorDialog
        initial={editRow}
        mode={editorMode}
        onClose={() => {
          setEditorOpen(false);
          setEditRow(null);
        }}
        onSaved={() => {
          void refresh();
        }}
        open={editorOpen}
      />
    </main>
  );
}
