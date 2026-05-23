"use client";

import { Languages, LogOut, Search, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBusinessSettings } from "@/bridge/settings";
import {
  ensureDefaultOwner,
  getStoredOperator,
  type StoredOperator,
  setStoredOperator,
} from "@/bridge/users";
import { NavIcon } from "@/components/app-icons";
import { navItemsForRole } from "@/components/app-nav";
import { CommandPalette } from "@/components/command-palette";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { OperatorLoginDialog } from "@/components/operator-login-dialog";
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
import { useI18n } from "@/i18n/hooks";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, locale, setLocale } = useI18n();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [operator, setOperator] = useState<StoredOperator | null>(null);
  const [showLogin, setShowLogin] = useState(false);

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

  useEffect(() => {
    (async () => {
      await ensureDefaultOwner();
      const stored = getStoredOperator();
      if (stored) {
        setOperator(stored);
      } else {
        setShowLogin(true);
      }
      const settings = await getBusinessSettings();
      setStoreName(settings.storeName);
      if (!settings.onboardingCompleted) {
        setShowOnboarding(true);
      }
    })().catch(() => undefined);
  }, []);

  const navItems = operator ? navItemsForRole(operator.role) : [];
  const sidebarSide = locale === "en" ? "left" : "right";

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar collapsible="offcanvas" side={sidebarSide}>
        <SidebarHeader className="border-sidebar-border border-b px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 font-semibold text-sm">
              <Store aria-hidden className="size-4 shrink-0 text-primary" />
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
              <SidebarMenu>
                {navItems.map((item) => {
                  const active = pathname === item.href;
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
            <Search
              aria-hidden
              className="size-3.5 shrink-0 text-muted-foreground"
            />
            <span className="text-muted-foreground text-xs">
              {t("shell.commandPalette")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {operator ? (
              <Button
                data-icon="inline-start"
                onClick={() => {
                  setStoredOperator(null);
                  setOperator(null);
                  setShowLogin(true);
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
              onClick={() => {
                setLocale(locale === "fa-AF" ? "en" : "fa-AF");
              }}
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
        <div className="min-h-0 flex-1 overflow-y-auto">
          {operator ? children : null}
        </div>
      </SidebarInset>
      <CommandPalette onOpenChange={setCmdOpen} open={cmdOpen} />
      <OperatorLoginDialog
        onLoggedIn={(op) => {
          setOperator(op);
          setShowLogin(false);
        }}
        open={showLogin}
      />
      <OnboardingWizard
        onComplete={(name) => {
          setStoreName(name);
          setShowOnboarding(false);
        }}
        open={showOnboarding && Boolean(operator)}
      />
    </SidebarProvider>
  );
}
