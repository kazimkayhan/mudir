import Image from "next/image";
import { cn } from "@/lib/utils";

export const APP_LOGO_SRC = "/brand/logo.png";

/** Wordmark aspect ratio (3543×1939 source). */
const LOGO_ASPECT = 3543 / 1939;

export function AppLogo({
  className,
  size = 40,
  priority = false,
}: {
  className?: string;
  size?: number;
  priority?: boolean;
}) {
  const height = size;
  const width = Math.round(size * LOGO_ASPECT);

  return (
    <Image
      alt=""
      aria-hidden
      className={cn("shrink-0 object-contain", className)}
      height={height}
      priority={priority}
      src={APP_LOGO_SRC}
      width={width}
    />
  );
}
