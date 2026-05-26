import type { Route } from "next";

/** Static-export friendly detail URLs (id resolved client-side from query). */
export function invoiceDetailHref(id: string): Route {
  return `/invoices/view?id=${encodeURIComponent(id)}` as Route;
}

export function productDetailHref(id: string): Route {
  return `/products/view?id=${encodeURIComponent(id)}` as Route;
}
