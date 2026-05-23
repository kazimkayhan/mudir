import type { AppNavHref } from "@/components/app-nav";
import { navIcons } from "@/components/nav-icons";
import { cn } from "@/lib/utils";

export function NavIcon({
  href,
  className,
}: {
  href: AppNavHref;
  className?: string;
}) {
  const Icon = navIcons[href];
  return (
    <Icon aria-hidden className={cn("size-4 shrink-0 opacity-80", className)} />
  );
}

export function PageTitle({
  href,
  children,
  className,
}: {
  href: AppNavHref;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = navIcons[href];
  return (
    <h1
      className={cn(
        "flex items-center gap-2.5 font-semibold text-2xl tracking-tight",
        className
      )}
    >
      <Icon aria-hidden className="size-7 shrink-0 text-primary/80" />
      <span>{children}</span>
    </h1>
  );
}

export function CardMetricIcon({
  href,
  className,
}: {
  href: AppNavHref;
  className?: string;
}) {
  const Icon = navIcons[href];
  return (
    <Icon
      aria-hidden
      className={cn("size-4 shrink-0 text-muted-foreground", className)}
    />
  );
}
