"use client";

import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
  href?: string;
  label: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  action?: EmptyStateAction;
  description: string;
  secondary?: EmptyStateAction;
  title: string;
}

function EmptyStateActionButton({
  action,
  variant = "default",
}: {
  action: EmptyStateAction;
  variant?: "default" | "outline";
}) {
  if (action.href) {
    return (
      <Button asChild type="button" variant={variant}>
        <Link href={action.href as Route}>{action.label}</Link>
      </Button>
    );
  }

  return (
    <Button onClick={action.onClick} type="button" variant={variant}>
      {action.label}
    </Button>
  );
}

export function EmptyState({
  action,
  description,
  secondary,
  title,
}: EmptyStateProps) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
      <h2 className="font-semibold text-lg">{title}</h2>
      <p className="mt-2 text-muted-foreground text-sm">{description}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {action ? <EmptyStateActionButton action={action} /> : null}
        {secondary ? (
          <EmptyStateActionButton action={secondary} variant="outline" />
        ) : null}
      </div>
    </div>
  );
}
