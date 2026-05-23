import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import type { AppNavHref } from "@/components/app-nav";

export const navIcons: Record<AppNavHref, LucideIcon> = {
  "/customers": Users,
  "/dashboard": LayoutDashboard,
  "/finance": Wallet,
  "/inventory": Warehouse,
  "/orders": ClipboardList,
  "/pos": ShoppingCart,
  "/products": Package,
  "/purchases": Truck,
  "/reports": BarChart3,
  "/settings": Settings,
};
