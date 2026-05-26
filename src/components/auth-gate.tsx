"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getLicenseStatus, isLicenseUsable } from "@/bridge/license";
import { getBusinessSettings } from "@/bridge/settings";
import { hasPasswordUsers } from "@/bridge/users";
import { resolveAuthRedirect } from "@/domain/auth/routing";
import { getStoredSession, isSessionValid } from "@/domain/auth/session";
import { routeLiteral } from "@/lib/route";
import { isWelcomeCompleted } from "@/lib/welcome";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const license = await getLicenseStatus();
        const settings = await getBusinessSettings();
        const hasUsers = await hasPasswordUsers();
        const redirect = resolveAuthRedirect({
          authed: isSessionValid(getStoredSession()),
          hasUsers,
          licenseOk: isLicenseUsable(license),
          onboardingCompleted: settings.onboardingCompleted,
          pathname,
          welcomeDone: isWelcomeCompleted(),
        });

        if (redirect) {
          router.replace(routeLiteral(redirect));
          return;
        }

        setReady(true);
      } catch {
        setReady(true);
      }
    })().catch(() => setReady(true));
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex h-svh items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
