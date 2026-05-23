"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  deleteExpense,
  type ExpenseRow,
  insertExpense,
  listExpenses,
  updateExpense,
} from "@/bridge/expenses";
import { PageTitle } from "@/components/app-icons";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
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
import type { TranslationKey } from "@/i18n";
import { useI18n } from "@/i18n/hooks";
import { formatDate, formatMoney } from "@/lib/format";
import { translateError } from "@/lib/translate-error";

const PRESETS = ["rent", "utilities", "transport", "salary", "other"] as const;

const CATEGORY_KEYS: Record<(typeof PRESETS)[number], TranslationKey> = {
  other: "finance.category.other",
  rent: "finance.category.rent",
  salary: "finance.category.salary",
  transport: "finance.category.transport",
  utilities: "finance.category.utilities",
};

function categoryLabel(
  t: (key: TranslationKey) => string,
  category: string
): string {
  if (category in CATEGORY_KEYS) {
    return t(CATEGORY_KEYS[category as (typeof PRESETS)[number]]);
  }
  return category;
}

export function FinanceClient() {
  const { t, locale } = useI18n();
  const catId = useId();
  const amtId = useId();
  const noteId = useId();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [category, setCategory] = useState("other");
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState<"AFN" | "USD">("AFN");
  const [expNote, setExpNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editRow, setEditRow] = useState<ExpenseRow | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setExpenses(await listExpenses(100));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(translateError(t, message));
    }
  }, [t]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const addExpense = async () => {
    setBusy(true);
    setError(null);
    try {
      await insertExpense({
        amount,
        category: category.trim(),
        currency_code: currency,
        note: expNote.trim() || undefined,
      });
      setExpNote("");
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(translateError(t, message));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editRow) {
      return;
    }
    setError(null);
    try {
      await updateExpense({
        amount: editRow.amount,
        category: editRow.category,
        currency_code: editRow.currency_code as "AFN" | "USD",
        id: editRow.id,
        note: editRow.note ?? undefined,
      });
      setEditRow(null);
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(translateError(t, message));
    }
  };

  const columns = useMemo<ColumnDef<ExpenseRow>[]>(
    () => [
      {
        accessorKey: "category",
        cell: ({ row }) => (
          <>
            {categoryLabel(t, row.original.category)}
            <div className="text-muted-foreground text-xs">
              {formatDate(row.original.created_at, locale)}
            </div>
          </>
        ),
        header: t("finance.title"),
      },
      {
        accessorKey: "amount",
        cell: ({ row }) =>
          formatMoney(
            row.original.amount,
            row.original.currency_code as "AFN" | "USD",
            locale
          ),
        header: t("products.salePrice"),
      },
      {
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              onClick={() => setEditRow(row.original)}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("common.edit")}
            </Button>
            <Button
              onClick={() => {
                deleteExpense(row.original.id)
                  .then(refresh)
                  .catch(() => undefined);
              }}
              size="sm"
              type="button"
              variant="destructive"
            >
              {t("common.delete")}
            </Button>
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
    <main className="mx-auto max-w-3xl px-6 pb-6">
      <PageHeader>
        <PageTitle href="/finance">{t("finance.title")}</PageTitle>
        <p className="mt-1 text-muted-foreground text-sm">
          {t("finance.addExpense")}
        </p>
      </PageHeader>

      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("finance.addExpense")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <Label htmlFor={catId}>{t("finance.title")}</Label>
              <Select onValueChange={setCategory} value={category}>
                <SelectTrigger id={catId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(CATEGORY_KEYS[p])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex gap-4">
              <Field className="min-w-0 flex-1">
                <Label htmlFor={amtId}>{t("products.salePrice")}</Label>
                <NumberInput
                  id={amtId}
                  onValueChange={setAmount}
                  value={amount}
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
                    <SelectItem value="AFN">AFN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <Label htmlFor={noteId}>{t("common.note")}</Label>
              <Input
                id={noteId}
                onChange={(e) => setExpNote(e.target.value)}
                value={expNote}
              />
            </Field>
            <Button
              data-icon="inline-start"
              disabled={busy}
              onClick={() => {
                addExpense().catch(() => undefined);
              }}
              type="button"
            >
              <Plus aria-hidden />
              {t("common.add")}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("finance.title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={expenses}
            getSearchText={(expense) =>
              [categoryLabel(t, expense.category), expense.note ?? ""].join(" ")
            }
          />
        </CardContent>
      </Card>

      <Dialog onOpenChange={() => setEditRow(null)} open={editRow !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("finance.editExpense")}</DialogTitle>
          </DialogHeader>
          {editRow ? (
            <FieldGroup>
              <Field>
                <Label>{t("finance.title")}</Label>
                <Input
                  onChange={(ev) =>
                    setEditRow({ ...editRow, category: ev.target.value })
                  }
                  value={editRow.category}
                />
              </Field>
              <Field>
                <Label>{t("products.salePrice")}</Label>
                <NumberInput
                  onValueChange={(amount) => setEditRow({ ...editRow, amount })}
                  value={editRow.amount}
                />
              </Field>
            </FieldGroup>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => {
                saveEdit().catch(() => undefined);
              }}
              type="button"
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
