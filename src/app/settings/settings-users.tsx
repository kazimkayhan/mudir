"use client";

import { useCallback, useEffect, useId, useState } from "react";
import {
  createUserWithPassword,
  listUsers,
  type UserRow,
} from "@/bridge/users";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
import { translateError } from "@/lib/translate-error";

export function SettingsUsersSection() {
  const t = useTranslations();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"owner" | "cashier">("cashier");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setUsers(await listUsers());
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const addUser = async () => {
    setError(null);
    try {
      await createUserWithPassword({ email, name, password, role });
      setName("");
      setEmail("");
      setPassword("");
      toastSuccess(t("common.toast.created"));
      await refresh();
    } catch (e: unknown) {
      toastTranslatedError(t, e);
      setError(translateError(t, e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <ul className="space-y-2 text-sm">
        {users.map((user) => (
          <li className="rounded-md border px-3 py-2" key={user.id}>
            <span className="font-medium">{user.name}</span>
            <span className="text-muted-foreground">
              {" "}
              · {user.email ?? "—"}
            </span>
            <span className="text-muted-foreground"> · {user.role}</span>
          </li>
        ))}
      </ul>
      <FieldGroup>
        <Field>
          <Label htmlFor={nameId}>{t("setup.adminName")}</Label>
          <Input
            id={nameId}
            onChange={(e) => setName(e.target.value)}
            value={name}
          />
        </Field>
        <Field>
          <Label htmlFor={emailId}>{t("auth.email")}</Label>
          <Input
            id={emailId}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            value={email}
          />
        </Field>
        <Field>
          <Label htmlFor={passwordId}>{t("auth.password")}</Label>
          <Input
            id={passwordId}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            value={password}
          />
        </Field>
        <Field>
          <Label>{t("settings.userRole")}</Label>
          <Select
            onValueChange={(v) => setRole(v as "owner" | "cashier")}
            value={role}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cashier">
                {t("settings.roleCashier")}
              </SelectItem>
              <SelectItem value="owner">{t("settings.roleOwner")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
      <Button
        disabled={!(name && email && password.length >= 8)}
        onClick={() => {
          addUser().catch(() => undefined);
        }}
        type="button"
      >
        {t("settings.addUser")}
      </Button>
    </div>
  );
}
