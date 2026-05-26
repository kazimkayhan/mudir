"use client";

import { useEffect, useState } from "react";
import { readFileAsDataUrl } from "@/bridge/file-data-url";
import { cn } from "@/lib/utils";

interface LocalAssetImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  loadingFallback?: React.ReactNode;
  path?: string | null;
}

/** Preview a file under AppData via Tauri (data URL — works without asset protocol). */
export function LocalAssetImage({
  path,
  className,
  alt = "",
  width = 48,
  height = 48,
  loadingFallback = null,
  ...props
}: LocalAssetImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!path) {
      setSrc(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    readFileAsDataUrl(path)
      .then((url) => {
        if (!cancelled) {
          setSrc(url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) {
    return null;
  }

  if (loading) {
    return loadingFallback;
  }

  if (!src) {
    return null;
  }

  return (
    // biome-ignore lint/performance/noImgElement: Tauri local file preview
    <img
      alt={alt}
      className={cn(className)}
      height={height}
      src={src}
      width={width}
      {...props}
    />
  );
}
