"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { appNav } from "@/components/app-nav";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      <div className="flex min-h-screen font-[family-name:var(--font-geist-sans)]">
        <aside className="flex w-56 shrink-0 flex-col border-neutral-200 border-r bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="border-neutral-200 border-b px-4 py-3 font-semibold text-sm dark:border-neutral-800">
            Mudir
          </div>
          <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 p-2">
            {appNav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm no-underline ${
                    active
                      ? "bg-neutral-200 font-medium dark:bg-neutral-800"
                      : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-neutral-200 border-b px-4 dark:border-neutral-800">
            <span className="text-neutral-500 text-xs">
              Ctrl+K — command palette
            </span>
            <ThemeToggle />
          </header>
          <div className="flex-1 overflow-auto">{children}</div>
        </div>
      </div>
      <CommandPalette onOpenChange={setCmdOpen} open={cmdOpen} />
    </>
  );
}
