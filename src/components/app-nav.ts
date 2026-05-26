import type { Role } from "@/domain/types";
import type { TranslationKey } from "@/i18n";

export type AppNavHref =
  | "/dashboard"
  | "/products"
  | "/inventory"
  | "/pos"
  | "/orders"
  | "/invoices"
  | "/purchases"
  | "/customers"
  | "/suppliers"
  | "/finance"
  | "/reports"
  | "/settings";

export const appNav: {
  href: AppNavHref;
  labelKey: TranslationKey;
  roles?: Role[];
}[] = [
  { href: "/dashboard", labelKey: "nav.dashboard" },
  { href: "/products", labelKey: "nav.products" },
  { href: "/inventory", labelKey: "nav.inventory" },
  { href: "/pos", labelKey: "nav.pos" },
  { href: "/invoices", labelKey: "nav.invoices" },
  { href: "/orders", labelKey: "nav.orders" },
  {
    href: "/purchases",
    labelKey: "nav.purchases",
    roles: ["owner", "admin", "manager"],
  },
  {
    href: "/suppliers",
    labelKey: "nav.suppliers",
    roles: ["owner", "admin", "manager"],
  },
  { href: "/customers", labelKey: "nav.customers" },
  { href: "/finance", labelKey: "nav.finance", roles: ["owner"] },
  {
    href: "/reports",
    labelKey: "nav.reports",
    roles: ["owner", "admin", "manager"],
  },
  { href: "/settings", labelKey: "nav.settings", roles: ["owner"] },
];

export function navItemsForRole(role: Role) {
  return appNav.filter((item) => !item.roles || item.roles.includes(role));
}
