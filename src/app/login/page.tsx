"use client";

import { Eye, EyeOff, Languages, Store } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { getBusinessSettings } from "@/bridge/settings";
import { loginSession, verifyCredentials } from "@/bridge/users";
import { AssetPreview } from "@/components/asset-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { loginSchema } from "@/domain/auth/schemas";
import {
  clearLoginLockout,
  isLoginLocked,
  recordFailedLogin,
} from "@/domain/auth/session";
import { useI18n } from "@/i18n/hooks";
import { translateError } from "@/lib/translate-error";

export default function LoginPage() {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setupDone = searchParams.get("setup") === "done";
  const emailId = useId();
  const passwordId = useId();
  const rememberId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [logoPath, setLogoPath] = useState<string | undefined>();

  useEffect(() => {
    getBusinessSettings()
      .then((s) => {
        setCompanyName(s.tradeName ?? s.storeName);
        setLogoPath(s.logoPath);
      })
      .catch(() => undefined);
  }, []);

  const submit = async () => {
    if (isLoginLocked()) {
      setError(t("auth.lockedOut"));
      return;
    }
    setBusy(true);
    setError(null);
    const parsed = loginSchema.safeParse({ email, password, remember });
    if (!parsed.success) {
      setError(t(parsed.error.issues[0]?.message as never));
      setBusy(false);
      return;
    }
    try {
      const user = await verifyCredentials(
        parsed.data.email,
        parsed.data.password
      );
      if (!user) {
        recordFailedLogin();
        setError(t("auth.invalidCredentials"));
        return;
      }
      clearLoginLockout();
      loginSession(user, parsed.data.remember ?? false);
      router.replace("/dashboard");
    } catch (e: unknown) {
      setError(translateError(t, e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-linear-to-br from-background via-background to-primary/5 p-6">
      <div className="absolute inset-e-4 top-4">
        <Button
          data-icon="inline-start"
          onClick={() => setLocale(locale === "fa-AF" ? "en" : "fa-AF")}
          size="sm"
          type="button"
          variant="outline"
        >
          <Languages aria-hidden />
          {locale === "fa-AF" ? t("shell.english") : t("shell.dari")}
        </Button>
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <LoginLogo logoPath={logoPath} />
          <div>
            <h1 className="font-semibold text-2xl tracking-tight">
              {companyName || t("app.name")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("auth.loginSubtitle")}
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {setupDone ? (
            <Alert className="mb-4">
              <AlertDescription>{t("auth.setupCompleteHint")}</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert className="mb-4" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit().catch(() => undefined);
            }}
          >
            <Field>
              <Label htmlFor={emailId}>{t("auth.email")}</Label>
              <Input
                autoComplete="email"
                id={emailId}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                value={email}
              />
            </Field>
            <Field>
              <Label htmlFor={passwordId}>{t("auth.password")}</Label>
              <InputGroup>
                <InputGroupInput
                  autoComplete="current-password"
                  id={passwordId}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label={
                      showPassword
                        ? t("auth.hidePassword")
                        : t("auth.showPassword")
                    }
                    onClick={() => setShowPassword((v) => !v)}
                    size="icon-xs"
                    type="button"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden className="size-4" />
                    ) : (
                      <Eye aria-hidden className="size-4" />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <div className="flex items-center gap-2.5">
              <Checkbox
                checked={remember}
                id={rememberId}
                onCheckedChange={(checked) => setRemember(checked === true)}
              />
              <Label
                className="cursor-pointer font-normal"
                htmlFor={rememberId}
              >
                {t("auth.rememberMe")}
              </Label>
            </div>
            <Button className="w-full" disabled={busy} type="submit">
              {t("auth.login")}
            </Button>
          </form>
        </div>

        <p className="text-center text-muted-foreground text-xs">
          {t("app.tagline")}
        </p>
      </div>
    </div>
  );
}

function LoginLogo({ logoPath }: { logoPath?: string }) {
  if (logoPath?.startsWith("http")) {
    return (
      <div className="flex size-24 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted/25 p-3 shadow-sm ring-1 ring-border/40">
        {/* biome-ignore lint/performance/noImgElement: remote logo URL */}
        <img
          alt=""
          className="max-h-full max-w-full object-contain"
          height={96}
          src={logoPath}
          width={96}
        />
      </div>
    );
  }

  if (logoPath) {
    return (
      <AssetPreview
        className="size-24 max-w-none p-3"
        path={logoPath}
        variant="stamp"
      />
    );
  }

  return (
    <div className="flex size-24 items-center justify-center rounded-2xl border border-border/60 bg-primary/10 shadow-sm ring-1 ring-primary/15">
      <Store aria-hidden className="size-10 text-primary" />
    </div>
  );
}
