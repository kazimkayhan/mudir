"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Header,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useTranslations } from "@/i18n/hooks";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 20, 50, 100] as const;

function renderColumnHeader<T>(header: Header<T, unknown>) {
  if (header.isPlaceholder) {
    return null;
  }

  if (!header.column.getCanSort()) {
    return flexRender(header.column.columnDef.header, header.getContext());
  }

  return (
    <Button
      className="-ms-3 h-8"
      onClick={header.column.getToggleSortingHandler()}
      size="sm"
      type="button"
      variant="ghost"
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
      {header.column.getIsSorted() === "asc" ? " ▲" : null}
      {header.column.getIsSorted() === "desc" ? " ▼" : null}
    </Button>
  );
}

export interface DataTableProps<T> {
  className?: string;
  columns: ColumnDef<T, unknown>[];
  data: T[];
  emptyMessage?: string;
  getSearchText?: (row: T) => string;
  initialSorting?: SortingState;
  pageSize?: number;
  searchPlaceholder?: string;
  showPagination?: boolean;
  showSearch?: boolean;
  tableClassName?: string;
  toolbar?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage,
  searchPlaceholder,
  getSearchText,
  pageSize = 20,
  className,
  tableClassName,
  showSearch = true,
  showPagination = true,
  initialSorting = [],
  toolbar,
}: DataTableProps<T>) {
  const t = useTranslations();
  const searchId = useId();
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const table = useReactTable({
    autoResetPageIndex: true,
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      if (!getSearchText) {
        return true;
      }
      const query = String(filterValue).trim().toLowerCase();
      if (query.length === 0) {
        return true;
      }
      return getSearchText(row.original).toLowerCase().includes(query);
    },
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    state: { globalFilter, pagination, sorting },
  });

  const searchEnabled = showSearch && Boolean(getSearchText);
  const toolbarEnabled = Boolean(toolbar);
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const paginationEnabled =
    showPagination && filteredRowCount > table.getState().pagination.pageSize;
  const resolvedEmptyMessage = emptyMessage ?? t("common.table.noResults");

  return (
    <div className={cn("flex flex-col", className)}>
      {searchEnabled || toolbarEnabled ? (
        <div className="flex flex-col gap-3 border-border border-b px-4 py-3 sm:flex-row sm:flex-wrap sm:items-end">
          {searchEnabled ? (
            <Field className="min-w-[12rem] flex-1">
              <Label htmlFor={searchId}>{t("common.search")}</Label>
              <Input
                className="max-w-md"
                id={searchId}
                onChange={(event) => {
                  setGlobalFilter(event.target.value);
                }}
                placeholder={searchPlaceholder ?? t("common.search")}
                type="search"
                value={globalFilter}
              />
            </Field>
          ) : null}
          {toolbar}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <Table className={tableClassName}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {renderColumnHeader(header)}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  className="py-8 text-center text-muted-foreground"
                  colSpan={columns.length}
                >
                  {resolvedEmptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell className="align-top" key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {paginationEnabled ? (
        <div className="flex flex-col gap-3 border-border border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">
            {t("common.table.rows", {
              count: filteredRowCount,
            })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="sr-only">{t("common.table.pageSize")}</Label>
            <Select
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
              value={String(table.getState().pagination.pageSize)}
            >
              <SelectTrigger className="h-8 w-[5.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!table.getCanPreviousPage()}
              onClick={() => {
                table.previousPage();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("common.table.previous")}
            </Button>
            <span className="min-w-[6rem] text-center text-muted-foreground">
              {t("common.table.page", {
                page: table.getState().pagination.pageIndex + 1,
                pages: Math.max(table.getPageCount(), 1),
              })}
            </span>
            <Button
              disabled={!table.getCanNextPage()}
              onClick={() => {
                table.nextPage();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("common.table.next")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
