"use client";

import { KeyRound } from "lucide-react";
import { useId, useState } from "react";
import {
  ensureDefaultOwner,
  type StoredOperator,
  setStoredOperator,
  verifyPin,
} from "@/bridge/users";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/hooks";
import { translateError } from "@/lib/translate-error";

interface OperatorLoginDialogProps {
  onLoggedIn: (operator: StoredOperator) => void;
  open: boolean;
}

export function OperatorLoginDialog({
  open,
  onLoggedIn,
}: OperatorLoginDialogProps) {
  const { t } = useI18n();
  const pinId = useId();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await ensureDefaultOwner();
      const user = await verifyPin(pin);
      if (!user) {
        setError(t("auth.invalidPin"));
        return;
      }
      const operator = { id: user.id, name: user.name, role: user.role };
      setStoredOperator(operator);
      onLoggedIn(operator);
      setPin("");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(translateError(t, message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("auth.login")}</DialogTitle>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <p className="text-muted-foreground text-sm">{t("auth.pinHint")}</p>
        <Field>
          <Label className="flex items-center gap-1.5" htmlFor={pinId}>
            <KeyRound aria-hidden className="size-3.5 shrink-0 opacity-70" />
            {t("auth.pin")}
          </Label>
          <Input
            autoComplete="off"
            dir="ltr"
            id={pinId}
            inputMode="numeric"
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                submit().catch(() => undefined);
              }
            }}
            type="password"
            value={pin}
          />
        </Field>
        <DialogFooter>
          <Button
            data-icon="inline-start"
            disabled={busy || pin.length === 0}
            onClick={() => {
              submit().catch(() => undefined);
            }}
            type="button"
          >
            <KeyRound aria-hidden />
            {t("auth.login")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
