"use client";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function PageHeader({ children, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 -mx-6 border-border border-b bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
    >
      {children}
    </div>
  );
}
