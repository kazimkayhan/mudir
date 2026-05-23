"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import {
  insertProduct,
  type ProductRow,
  updateProduct,
} from "@/bridge/products";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ProductWriteInput,
  productWriteSchema,
} from "@/domain/products/schemas";
import { useTranslations } from "@/i18n/hooks";
import { parseNumberInput } from "@/lib/number-input";

interface ProductEditorDialogProps {
  initial: ProductRow | null;
  mode: "create" | "edit";
  onClose: () => void;
  onSaved: () => void;
  open: boolean;
}

export function ProductEditorDialog({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: ProductEditorDialogProps) {
  const t = useTranslations();
  const nameId = useId();
  const skuId = useId();
  const barcodeId = useId();
  const saleId = useId();
  const costId = useId();
  const thresholdId = useId();
  const conditionId = useId();
  const openingId = useId();
  const formId = useId();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<ProductWriteInput>({
    defaultValues: {
      barcode: "",
      condition: "new",
      cost_price: 0,
      currency: "AFN",
      low_stock_threshold: 0,
      name: "",
      opening_qty: 0,
      sale_price: 0,
      sku: "",
    },
    resolver: zodResolver(productWriteSchema),
  });

  const currency = watch("currency");
  const condition = watch("condition");
  const numberField = (name: keyof ProductWriteInput) =>
    register(name, {
      setValueAs: (value) => parseNumberInput(String(value)),
    });

  useEffect(() => {
    if (!open) {
      return;
    }
    setSubmitError(null);
    if (mode === "edit" && initial) {
      reset({
        barcode: initial.barcode ?? "",
        condition: initial.condition,
        cost_price: initial.cost_price,
        currency: (initial.currency as "AFN" | "USD") ?? "AFN",
        low_stock_threshold: initial.low_stock_threshold,
        name: initial.name,
        sale_price: initial.sale_price,
        sku: initial.sku ?? "",
      });
    } else {
      reset({
        barcode: "",
        condition: "new",
        cost_price: 0,
        currency: "AFN",
        low_stock_threshold: 0,
        name: "",
        opening_qty: 0,
        sale_price: 0,
        sku: "",
      });
    }
  }, [open, mode, initial, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (mode === "create") {
        await insertProduct(values);
      } else if (initial) {
        await updateProduct({ ...values, id: initial.id });
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSubmitError(t(msg as never) || msg);
    }
  });

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("products.add") : t("common.edit")}
          </DialogTitle>
        </DialogHeader>

        {submitError ? (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <form id={formId} onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <Label htmlFor={nameId}>{t("validation.nameRequired")}</Label>
              <Input dir="auto" id={nameId} {...register("name")} />
            </Field>
            <Field>
              <Label htmlFor={skuId}>{t("common.sku")}</Label>
              <Input id={skuId} {...register("sku")} />
            </Field>
            <Field>
              <Label htmlFor={barcodeId}>{t("products.barcode")}</Label>
              <Input id={barcodeId} {...register("barcode")} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor={saleId}>{t("products.salePrice")}</Label>
                <Input
                  id={saleId}
                  min={0}
                  step="0.01"
                  type="number"
                  {...numberField("sale_price")}
                />
              </Field>
              <Field>
                <Label htmlFor={costId}>{t("products.costPrice")}</Label>
                <Input
                  id={costId}
                  min={0}
                  step="0.01"
                  type="number"
                  {...numberField("cost_price")}
                />
              </Field>
            </div>
            <Field>
              <Label htmlFor={conditionId}>
                {t("products.condition.label")}
              </Label>
              <Select
                onValueChange={(value) =>
                  setValue("condition", value === "used" ? "used" : "new")
                }
                value={condition}
              >
                <SelectTrigger id={conditionId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">
                    {t("products.condition.new")}
                  </SelectItem>
                  <SelectItem value="used">
                    {t("products.condition.used")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label>{t("common.currency.afn")}</Label>
              <Select
                onValueChange={(v) => setValue("currency", v as "AFN" | "USD")}
                value={currency}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AFN">AFN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor={thresholdId}>{t("products.lowStock")}</Label>
              <Input
                id={thresholdId}
                min={0}
                type="number"
                {...numberField("low_stock_threshold")}
              />
            </Field>
            {mode === "create" ? (
              <Field>
                <Label htmlFor={openingId}>{t("nav.inventory")}</Label>
                <Input
                  id={openingId}
                  min={0}
                  type="number"
                  {...numberField("opening_qty")}
                />
              </Field>
            ) : (
              <p className="text-muted-foreground text-xs">
                {t("nav.inventory")}: {initial?.on_hand_qty ?? 0}
              </p>
            )}
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            {t("common.cancel")}
          </Button>
          <Button disabled={isSubmitting} form={formId} type="submit">
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
