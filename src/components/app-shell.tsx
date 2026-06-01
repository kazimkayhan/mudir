"use client";

import { Languages, LogOut, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { runDailyBackupIfNeeded } from "@/bridge/backup";
import { getBusinessSettings } from "@/bridge/settings";
import type { StoredOperator } from "@/bridge/users";
import { getStoredOperator, setStoredOperator } from "@/bridge/users";
import { NavIcon } from "@/components/app-icons";
import { AppLogo } from "@/components/app-logo";
import { navItemsForRole } from "@/components/app-nav";
import { CommandPalette } from "@/components/command-palette";
import { LicenseExpiryBanner } from "@/components/license-expiry-banner";
import { HelpMenu } from "@/components/onboarding/help-menu";
import { useModuleTour } from "@/components/onboarding/use-module-tour";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { setStoredSession } from "@/domain/auth/session";
import { useI18n } from "@/i18n/hooks";

const PUBLIC_PATHS = new Set(["/activate", "/welcome", "/login", "/setup"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [operator, setOperator] = useState<StoredOperator | null>(null);

  const isPublicPage = PUBLIC_PATHS.has(pathname);

  useModuleTour("app-shell", !isPublicPage);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (isPublicPage) {
      return;
    }
    const stored = getStoredOperator();
    setOperator(stored);
    getBusinessSettings()
      .then((s) => {
        const name = s.tradeName ?? s.storeName;
        setStoreName(name);
        if (name) {
          runDailyBackupIfNeeded(name).catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }, [isPublicPage]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  const navItems = operator ? navItemsForRole(operator.role) : [];
  const sidebarSide = locale === "en" ? "left" : "right";

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar collapsible="offcanvas" side={sidebarSide}>
        <SidebarHeader className="border-sidebar-border border-b px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 font-semibold text-sm">
              <AppLogo size={20} />
              {t("app.name")}
            </span>
            {storeName ? (
              <span className="text-muted-foreground text-xs">{storeName}</span>
            ) : null}
            {operator ? (
              <span className="text-muted-foreground text-xs">
                {t("auth.welcome", { name: operator.name })}
              </span>
            ) : null}
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu data-tour="sidebar-nav">
                {navItems.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link
                          className="flex items-center gap-2"
                          href={item.href}
                        >
                          <NavIcon href={item.href} />
                          <span>{t(item.labelKey)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="min-h-0 flex-1">
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-border border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator className="h-4" orientation="vertical" />
            <button
              className="flex items-center gap-2 text-muted-foreground text-xs hover:text-foreground"
              data-tour="command-palette"
              onClick={() => setCmdOpen(true)}
              type="button"
            >
              <Search aria-hidden className="size-3.5 shrink-0" />
              {t("shell.commandPalette")}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <HelpMenu />
            {operator ? (
              <Button
                data-icon="inline-start"
                onClick={() => {
                  setStoredSession(null);
                  setStoredOperator(null);
                  setOperator(null);
                  router.replace("/login");
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <LogOut aria-hidden />
                {t("auth.logout")}
              </Button>
            ) : null}
            <Button
              data-icon="inline-start"
              onClick={() => setLocale(locale === "fa-AF" ? "en" : "fa-AF")}
              size="sm"
              type="button"
              variant="outline"
            >
              <Languages aria-hidden />
              {locale === "fa-AF" ? t("shell.english") : t("shell.dari")}
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <LicenseExpiryBanner />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>
      <CommandPalette onOpenChange={setCmdOpen} open={cmdOpen} />
    </SidebarProvider>
  );
}
