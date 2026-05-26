"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  const [dir, setDir] = useState<"ltr" | "rtl">("rtl");

  useEffect(() => {
    const root = document.documentElement;
    const readDir = () => {
      setDir(root.dir === "ltr" ? "ltr" : "rtl");
    };
    readDir();
    const observer = new MutationObserver(readDir);
    observer.observe(root, { attributeFilter: ["dir"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      className="toaster group"
      closeButton
      dir={dir}
      position="top-center"
      richColors
      toastOptions={{
        classNames: {
          description: "group-[.toast]:text-muted-foreground",
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
        },
      }}
    />
  );
}
