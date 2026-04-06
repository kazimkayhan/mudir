"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { appNav } from "@/components/app-nav";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close command palette"
        onClick={() => {
          onOpenChange(false);
        }}
      />
      <div className="absolute top-[12%] left-1/2 w-[min(100%-2rem,28rem)] -translate-x-1/2">
        <Command className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
          <Command.Input
            placeholder="Jump to page…"
            className="w-full border-b border-neutral-200 bg-transparent px-3 py-2.5 text-sm outline-none dark:border-neutral-800"
          />
          <Command.List className="max-h-72 overflow-y-auto p-1">
            <Command.Empty className="px-3 py-6 text-center text-sm text-neutral-500">
              No matches.
            </Command.Empty>
            <Command.Group
              heading="Pages"
              className="px-2 py-1 text-[11px] font-medium text-neutral-500 uppercase tracking-wide"
            >
              {appNav.map((item) => (
                <Command.Item
                  key={item.href}
                  value={`${item.label} ${item.href}`}
                  onSelect={() => {
                    router.push(item.href);
                    onOpenChange(false);
                  }}
                  className="cursor-pointer rounded-md px-2 py-2 text-sm text-neutral-900 aria-selected:bg-neutral-100 dark:text-neutral-100 dark:aria-selected:bg-neutral-900"
                >
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
