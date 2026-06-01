import type { Metadata } from "next";
import { Noto_Sans_Arabic } from "next/font/google";
import { AppDirection } from "@/components/app-direction";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { TourProvider } from "@/components/onboarding/tour-provider";
import { TourSpotlight } from "@/components/onboarding/tour-spotlight";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n/provider";
import "@/styles/globals.css";
import { themeInitScript } from "@/lib/theme";
import { cn } from "@/lib/utils";

const fontSans = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  description: "مدیریت آسان و آفلاین",
  icons: {
    apple: "/brand/logo.png",
    icon: "/brand/logo.png",
  },
  title: "مدیر — Mudir",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={cn("font-sans", fontSans.variable)}
      dir="rtl"
      lang="fa-AF"
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme bootstrap, no user input */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <I18nProvider>
          <AppDirection>
            <TooltipProvider>
              <AuthGate>
                <TourProvider>
                  <AppShell>{children}</AppShell>
                  <Toaster />
                  <TourSpotlight />
                </TourProvider>
              </AuthGate>
            </TooltipProvider>
          </AppDirection>
        </I18nProvider>
      </body>
    </html>
  );
}
