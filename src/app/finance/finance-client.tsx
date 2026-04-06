"use client";

import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useId, useState } from "react";
import {
  type CashSessionRow,
  closeCashSession,
  getOpenCashSession,
  openCashSession,
} from "@/bridge/cash-sessions";
import {
  type ExpenseRow,
  insertExpense,
  listExpenses,
} from "@/bridge/expenses";

export function FinanceClient() {
  const uid = useId();
  const catId = `${uid}-cat`;
  const amtId = `${uid}-amt`;
  const noteId = `${uid}-note`;
  const openBalId = `${uid}-openbal`;
  const openNoteId = `${uid}-opennote`;
  const closeBalId = `${uid}-closebal`;

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [session, setSession] = useState<CashSessionRow | null>(null);
  const [category, setCategory] = useState("general");
  const [amount, setAmount] = useState(10);
  const [expNote, setExpNote] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [sessionNote, setSessionNote] = useState("");
  const [closingBalance, setClosingBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [e, s] = await Promise.all([
        listExpenses(100),
        getOpenCashSession(),
      ]);
      setExpenses(e);
      setSession(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addExpense = async () => {
    setBusy(true);
    setError(null);
    try {
      await insertExpense({
        category: category.trim(),
        amount,
        note: expNote.trim() || undefined,
      });
      setExpNote("");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openSession = async () => {
    setBusy(true);
    setError(null);
    try {
      await openCashSession({
        openingBalance,
        note: sessionNote.trim() || undefined,
      });
      setSessionNote("");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const closeSession = async () => {
    if (!session) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await closeCashSession({
        sessionId: session.id,
        closingBalance,
      });
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="font-semibold text-2xl tracking-tight">Finance</h1>
      <p className="mt-1 text-neutral-600 text-sm dark:text-neutral-400">
        Expenses and a simple cash session (open / close with counted balances).
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
        <h2 className="font-medium text-lg">Cash session</h2>
        {session ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              Open since{" "}
              <span className="font-mono text-xs">
                {new Date(session.opened_at).toLocaleString()}
              </span>
            </p>
            <p>Opening balance: {Number(session.opening_balance).toFixed(2)}</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <label
                  className="text-neutral-600 text-xs dark:text-neutral-400"
                  htmlFor={closeBalId}
                >
                  Closing count
                </label>
                <input
                  id={closeBalId}
                  type="number"
                  min={0}
                  step="any"
                  className="w-36 rounded-md border border-neutral-300 px-2 py-2 dark:border-neutral-600"
                  value={closingBalance}
                  onChange={(e) => {
                    setClosingBalance(Number.parseFloat(e.target.value) || 0);
                  }}
                />
              </div>
              <button
                type="button"
                disabled={busy || !isTauri()}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
                onClick={() => {
                  void closeSession();
                }}
              >
                Close session
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label
                className="text-neutral-600 text-xs dark:text-neutral-400"
                htmlFor={openBalId}
              >
                Opening balance
              </label>
              <input
                id={openBalId}
                type="number"
                min={0}
                step="any"
                className="w-36 rounded-md border border-neutral-300 px-2 py-2 dark:border-neutral-600"
                value={openingBalance}
                onChange={(e) => {
                  setOpeningBalance(Number.parseFloat(e.target.value) || 0);
                }}
              />
            </div>
            <div className="flex min-w-[10rem] flex-col gap-1">
              <label
                className="text-neutral-600 text-xs dark:text-neutral-400"
                htmlFor={openNoteId}
              >
                Note
              </label>
              <input
                id={openNoteId}
                className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
                value={sessionNote}
                onChange={(e) => {
                  setSessionNote(e.target.value);
                }}
              />
            </div>
            <button
              type="button"
              disabled={busy || !isTauri()}
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
              onClick={() => {
                void openSession();
              }}
            >
              Open session
            </button>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="font-medium text-lg">New expense</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label
              className="text-neutral-600 text-xs dark:text-neutral-400"
              htmlFor={catId}
            >
              Category
            </label>
            <input
              id={catId}
              className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-neutral-600 text-xs dark:text-neutral-400"
              htmlFor={amtId}
            >
              Amount
            </label>
            <input
              id={amtId}
              type="number"
              min={0}
              step="any"
              className="w-32 rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
              value={amount}
              onChange={(e) => {
                setAmount(Number.parseFloat(e.target.value) || 0);
              }}
            />
          </div>
          <div className="flex min-w-[8rem] flex-1 flex-col gap-1">
            <label
              className="text-neutral-600 text-xs dark:text-neutral-400"
              htmlFor={noteId}
            >
              Note
            </label>
            <input
              id={noteId}
              className="rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-600"
              value={expNote}
              onChange={(e) => {
                setExpNote(e.target.value);
              }}
            />
          </div>
          <button
            type="button"
            disabled={busy || !category.trim() || amount <= 0 || !isTauri()}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            onClick={() => {
              void addExpense();
            }}
          >
            Save expense
          </button>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-medium text-lg">Recent expenses</h2>
        <ul className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {expenses.length === 0 ? (
            <li className="px-3 py-6 text-neutral-500 text-sm">None yet.</li>
          ) : (
            expenses.map((x) => (
              <li key={x.id} className="flex justify-between px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{x.category}</span>
                  {x.note ? (
                    <span className="text-neutral-500 text-xs">
                      {" "}
                      — {x.note}
                    </span>
                  ) : null}
                </span>
                <span className="font-mono">{Number(x.amount).toFixed(2)}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
