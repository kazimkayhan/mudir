"use client";

import { Upload } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { importProductsBatch } from "@/bridge/products";
import { getBusinessSettings } from "@/bridge/settings";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  parsePowerLightStockReportText,
  parseStockReportCsv,
  type StockReportImportRow,
  stockReportRowToProductInput,
} from "@/domain/products/stock-report-import";
import { useTranslations } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
import { extractTextFromStockReportPdf } from "@/lib/stock-report-pdf";
import { translateError } from "@/lib/translate-error";

interface ProductImportDialogProps {
  onClose: () => void;
  onImported: () => void;
  open: boolean;
}

interface ParsedPreview {
  fileName: string;
  rows: StockReportImportRow[];
  skippedLines: number;
}

export function ProductImportDialog({
  open,
  onClose,
  onImported,
}: ProductImportDialogProps) {
  const t = useTranslations();
  const fileInputId = useId();
  const [currency, setCurrency] = useState<"AFN" | "USD">("USD");
  const [salePriceMode, setSalePriceMode] = useState<"same_as_cost" | "zero">(
    "same_as_cost"
  );
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    getBusinessSettings()
      .then((settings) => {
        setCurrency(settings.baseCurrency);
      })
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setParseError(null);
      setIsParsing(false);
      setIsImporting(false);
    }
  }, [open]);

  async function handleFileChange(file: File | null) {
    setPreview(null);
    setParseError(null);
    if (!file) {
      return;
    }

    setIsParsing(true);
    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".pdf")) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const text = await extractTextFromStockReportPdf(bytes);
        const parsed = parsePowerLightStockReportText(text);
        if (parsed.rows.length === 0) {
          throw new Error("products.import.noRows");
        }
        setPreview({
          fileName: file.name,
          rows: parsed.rows,
          skippedLines: parsed.skippedLines,
        });
        return;
      }

      if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) {
        const text = await file.text();
        const parsed = parseStockReportCsv(text);
        if (parsed.rows.length === 0) {
          throw new Error("products.import.noRows");
        }
        setPreview({
          fileName: file.name,
          rows: parsed.rows,
          skippedLines: parsed.skippedLines,
        });
        return;
      }

      throw new Error("products.import.unsupportedFile");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setParseError(translateError(t, message));
    } finally {
      setIsParsing(false);
    }
  }

  async function handleImport() {
    if (!preview) {
      return;
    }
    setIsImporting(true);
    try {
      const items = preview.rows.map((row) =>
        stockReportRowToProductInput(row, {
          currency,
          salePriceMode,
        })
      );
      const result = await importProductsBatch(items);
      toastSuccess(
        t("products.import.result", {
          imported: result.imported,
          skippedDuplicates: result.skippedDuplicates,
          skippedInvalid: result.skippedInvalid,
          skippedLines: preview.skippedLines,
        })
      );
      onImported();
      onClose();
    } catch (error: unknown) {
      toastTranslatedError(t, error);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      open={open}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("products.import.title")}</DialogTitle>
        </DialogHeader>

        <FieldGroup>
          <p className="text-muted-foreground text-sm">
            {t("products.import.description")}
          </p>

          <Field>
            <Label htmlFor={fileInputId}>{t("products.import.file")}</Label>
            <input
              accept=".pdf,.csv,.txt"
              className="block w-full text-sm file:me-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
              id={fileInputId}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                handleFileChange(file).catch(() => undefined);
              }}
              type="file"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label>{t("common.currency.afn")} / USD</Label>
              <Select
                onValueChange={(value) => {
                  setCurrency(value === "USD" ? "USD" : "AFN");
                }}
                value={currency}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AFN">
                    {t("common.currency.afn")}
                  </SelectItem>
                  <SelectItem value="USD">
                    {t("common.currency.usd")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <Label>{t("products.import.salePriceMode")}</Label>
              <Select
                onValueChange={(value) => {
                  setSalePriceMode(value === "zero" ? "zero" : "same_as_cost");
                }}
                value={salePriceMode}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="same_as_cost">
                    {t("products.import.salePriceSameAsCost")}
                  </SelectItem>
                  <SelectItem value="zero">
                    {t("products.import.salePriceZero")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {isParsing ? (
            <p className="text-muted-foreground text-sm">
              {t("products.import.parsing")}
            </p>
          ) : null}

          {preview ? (
            <Alert>
              <AlertDescription>
                {t("products.import.preview", {
                  count: preview.rows.length,
                  fileName: preview.fileName,
                  skippedLines: preview.skippedLines,
                })}
              </AlertDescription>
            </Alert>
          ) : null}

          {parseError ? (
            <Alert variant="destructive">
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>

        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            {t("common.cancel")}
          </Button>
          <Button
            data-icon="inline-start"
            disabled={!preview || isImporting || isParsing}
            onClick={() => {
              handleImport().catch(() => undefined);
            }}
            type="button"
          >
            <Upload aria-hidden />
            {t("products.import.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
