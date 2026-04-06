"use client";

import { invoke, isTauri } from "@tauri-apps/api/core";
import { ask, message, open, save } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useId, useState } from "react";
import { type AuditLogRow, listRecentAuditLogs } from "@/bridge/audit";

export function SettingsClient() {
  const backupSectionId = useId();
  const auditSectionId = useId();
  const [audit, setAudit] = useState<AuditLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshAudit = useCallback(async () => {
    setError(null);
    try {
      const rows = await listRecentAuditLogs(100);
      setAudit(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refreshAudit();
  }, [refreshAudit]);

  const runBackup = async () => {
    if (!isTauri()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const destPath = await save({
        title: "Backup Mudir database",
        defaultPath: "mudir-backup.db",
        filters: [{ name: "SQLite", extensions: ["db"] }],
      });
      if (!destPath) {
        return;
      }
      await invoke("backup_mudir_database", { destPath });
      await message("Backup completed.", { title: "Mudir" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      await message(msg, { title: "Backup failed", kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const runRestore = async () => {
    if (!isTauri()) {
      return;
    }
    const ok = await ask(
      "This replaces your current database file. Close and restart the app after restore. Continue?",
      { title: "Restore database", kind: "warning" },
    );
    if (!ok) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const selected = await open({
        title: "Select backup file",
        multiple: false,
        filters: [{ name: "SQLite", extensions: ["db"] }],
      });
      if (selected === null || Array.isArray(selected)) {
        return;
      }
      await invoke("restore_mudir_database", { srcPath: selected });
      await message(
        "Database file replaced. Quit Mudir completely and open it again so SQLite reloads.",
        { title: "Restore complete", kind: "warning" },
      );
      await refreshAudit();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      await message(msg, { title: "Restore failed", kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
      <p className="mt-1 text-neutral-600 text-sm dark:text-neutral-400">
        Backup, restore, and audit trail (Phase 8).
      </p>

      {error ? (
        <p className="mt-4 text-red-600 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {!isTauri() ? (
        <p className="mt-4 text-amber-800 text-sm dark:text-amber-200">
          Backup and restore run only inside{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
            pnpm tauri dev
          </code>
          .
        </p>
      ) : null}

      <section
        className="mt-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
        aria-labelledby={backupSectionId}
      >
        <h2 className="font-medium text-lg" id={backupSectionId}>
          Database backup & restore
        </h2>
        <p className="mt-2 text-neutral-600 text-sm dark:text-neutral-400">
          Copies{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
            mudir.db
          </code>{" "}
          from the app config folder. Restore overwrites the live file — restart
          the app afterward.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !isTauri()}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            onClick={() => {
              void runBackup();
            }}
          >
            Backup…
          </button>
          <button
            type="button"
            disabled={busy || !isTauri()}
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-800 disabled:opacity-50 dark:border-red-900 dark:text-red-200"
            onClick={() => {
              void runRestore();
            }}
          >
            Restore…
          </button>
        </div>
      </section>

      <section className="mt-10" aria-labelledby={auditSectionId}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium text-lg" id={auditSectionId}>
            Recent audit log
          </h2>
          <button
            type="button"
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-600"
            disabled={!isTauri()}
            onClick={() => {
              void refreshAudit();
            }}
          >
            Refresh
          </button>
        </div>
        <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto rounded-lg border border-neutral-200 p-2 text-xs dark:border-neutral-800">
          {audit.length === 0 ? (
            <li className="text-neutral-500">No entries yet.</li>
          ) : (
            audit.map((row) => (
              <li
                key={row.id}
                className="rounded border border-neutral-100 px-2 py-2 dark:border-neutral-900"
              >
                <div className="font-mono opacity-70">{row.created_at}</div>
                <div>
                  <span className="font-medium">{row.action}</span>
                  <span className="text-neutral-500"> · {row.entity}</span>
                  <span className="font-mono text-neutral-500">
                    {" "}
                    {row.entity_id.slice(0, 12)}…
                  </span>
                </div>
                <div className="text-neutral-500">
                  actor {row.actor_user_id}
                </div>
                {row.payload ? (
                  <div className="mt-1 break-all opacity-80">{row.payload}</div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
