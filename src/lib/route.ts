import type { Route } from "next";

/** Typed-route-safe href for `router.push` / `router.replace` and `<Link href>`. */
export function routeLiteral(href: string): Route {
  return href as Route;
}
