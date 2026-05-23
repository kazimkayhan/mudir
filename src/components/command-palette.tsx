"use client";

import { useRouter } from "next/navigation";
import { NavIcon } from "@/components/app-icons";
import { appNav } from "@/components/app-nav";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useI18n } from "@/i18n/hooks";

interface CommandPaletteProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <CommandDialog
      description={t("shell.commandPaletteDesc")}
      onOpenChange={onOpenChange}
      open={open}
      title={t("shell.commandPalette")}
    >
      <Command>
        <CommandInput placeholder={t("common.search")} />
        <CommandList>
          <CommandEmpty>{t("common.empty")}</CommandEmpty>
          <CommandGroup heading={t("nav.dashboard")}>
            {appNav.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => {
                  router.push(item.href);
                  onOpenChange(false);
                }}
                value={`${t(item.labelKey)} ${item.href}`}
              >
                <NavIcon href={item.href} />
                {t(item.labelKey)}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
