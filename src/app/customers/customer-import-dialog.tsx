"use client";

import { Upload } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { insertCustomer, listCustomers } from "@/bridge/customers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { parseCustomerImportCsv } from "@/domain/export/customer-import";
import { useTranslations } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
import { translateError } from "@/lib/translate-error";

interface CustomerImportDialogProps {
  onClose: () => void;
  onImported: () => void;
  open: boolean;
}

export function CustomerImportDialog({
  open,
  onClose,
  onImported,
}: CustomerImportDialogProps) {
  const t = useTranslations();
  const fileInputId = useId();
  const [previewCount, setPreviewCount] = useState(0);
  const [rows, setRows] = useState<ReturnType<typeof parseCustomerImportCsv>>(
    []
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setPreviewCount(0);
      setRows([]);
      setParseError(null);
      setBusy(false);
    }
  }, [open]);

  const onFile = async (file: File) => {
    setParseError(null);
    try {
      const text = await file.text();
      const parsed = parseCustomerImportCsv(text);
      if (parsed.length === 0) {
        setParseError(t("data.import.customers.noRows"));
        setRows([]);
        setPreviewCount(0);
        return;
      }
      setRows(parsed);
      setPreviewCount(parsed.length);
    } catch (e: unknown) {
      setParseError(
        translateError(t, e instanceof Error ? e.message : String(e))
      );
      setRows([]);
      setPreviewCount(0);
    }
  };

  const submit = async () => {
    setBusy(true);
    setParseError(null);
    try {
      const existing = await listCustomers(5000);
      const phones = new Set(
        existing.map((c) => c.phone?.trim()).filter(Boolean)
      );
      let imported = 0;
      let skipped = 0;
      for (const row of rows) {
        if (row.phone && phones.has(row.phone)) {
          skipped += 1;
          continue;
        }
        await insertCustomer({
          address: row.address || undefined,
          name: row.name,
          note: row.note || undefined,
          phone: row.phone || undefined,
        });
        if (row.phone) {
          phones.add(row.phone);
        }
        imported += 1;
      }
      toastSuccess(
        t("data.import.customers.result", {
          imported: String(imported),
          skipped: String(skipped),
        })
      );
      onImported();
      onClose();
    } catch (e: unknown) {
      toastTranslatedError(t, e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("data.import.customersTitle")}</DialogTitle>
        </DialogHeader>

        {parseError ? (
          <Alert variant="destructive">
            <AlertDescription>{parseError}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup>
          <Field>
            <Label htmlFor={fileInputId}>{t("data.import.file")}</Label>
            <input
              accept=".csv,text/csv"
              className="block w-full text-sm"
              id={fileInputId}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onFile(file).catch(() => undefined);
                }
              }}
              type="file"
            />
          </Field>
          {previewCount > 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("data.import.customers.preview", {
                count: String(previewCount),
              })}
            </p>
          ) : null}
        </FieldGroup>

        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            {t("common.cancel")}
          </Button>
          <Button
            data-icon="inline-start"
            disabled={busy || rows.length === 0}
            onClick={() => {
              submit().catch(() => undefined);
            }}
            type="button"
          >
            <Upload aria-hidden />
            {t("data.import.customers.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
