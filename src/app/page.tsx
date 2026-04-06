"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <p className="p-6 text-neutral-500 text-sm">Redirecting to dashboard…</p>
  );
}
