"use client";

import { ImageIcon } from "lucide-react";
import { LocalAssetImage } from "@/components/local-asset-image";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AssetPreviewVariant = "logo" | "stamp" | "thumbnail";

const frameStyles: Record<AssetPreviewVariant, string> = {
  logo: "aspect-[5/3] w-full max-w-48 rounded-2xl p-4",
  stamp: "aspect-square w-28 rounded-2xl p-3",
  thumbnail: "aspect-square w-24 rounded-xl p-1.5",
};

interface AssetPreviewProps {
  className?: string;
  imageClassName?: string;
  path?: string | null;
  variant?: AssetPreviewVariant;
}

export function AssetPreview({
  path,
  variant = "logo",
  className,
  imageClassName,
}: AssetPreviewProps) {
  const frameClass = cn(
    "flex shrink-0 items-center justify-center overflow-hidden border border-border/60 bg-muted/25 shadow-sm ring-1 ring-border/40",
    frameStyles[variant],
    className
  );

  if (!path) {
    return (
      <div className={frameClass}>
        <ImageIcon aria-hidden className="size-8 text-muted-foreground/35" />
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <LocalAssetImage
        className={cn("max-h-full max-w-full object-contain", imageClassName)}
        height={variant === "logo" ? 120 : 96}
        loadingFallback={
          <Skeleton
            aria-hidden
            className={cn(
              "rounded-xl",
              variant === "logo" ? "h-16 w-28" : "size-16"
            )}
          />
        }
        path={path}
        width={variant === "logo" ? 160 : 96}
      />
    </div>
  );
}
