"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { type BrandRow, listBrands } from "@/bridge/brands";
import { type CategoryRow, listCategories } from "@/bridge/categories";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  PRODUCT_TYPES,
  type ProductWriteFormInput,
  productWriteSchema,
  TRACKING_MODES,
} from "@/domain/products/schemas";
import { useTranslations } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
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
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<ProductWriteFormInput>({
    defaultValues: {
      barcode: "",
      brand_id: undefined,
      category_id: undefined,
      condition: "new",
      cost_price: 0,
      country_of_origin: "",
      currency: "AFN",
      description: "",
      hs_code: "",
      low_stock_threshold: 0,
      min_sale_qty: 1,
      model_number: "",
      name: "",
      opening_qty: 0,
      product_type: "consumable",
      requires_license: false,
      sale_price: 0,
      sku: "",
      tracking_mode: "none",
      unit_of_measure: "piece",
      warranty_months: undefined,
    },
    resolver: zodResolver(productWriteSchema),
  });

  const currency = watch("currency");
  const condition = watch("condition");
  const productType = watch("product_type");
  const trackingMode = watch("tracking_mode");
  const numberField = (name: keyof ProductWriteFormInput) =>
    register(name, {
      setValueAs: (value) => parseNumberInput(String(value)),
    });

  useEffect(() => {
    if (!open) {
      return;
    }
    setSubmitError(null);
    Promise.all([listCategories(), listBrands()])
      .then(([cats, brandRows]) => {
        setCategories(cats);
        setBrands(brandRows);
      })
      .catch(() => undefined);
    if (mode === "edit" && initial) {
      reset({
        barcode: initial.barcode ?? "",
        brand_id: initial.brand_id ?? undefined,
        category_id: initial.category_id ?? undefined,
        condition: initial.condition,
        cost_price: initial.cost_price,
        country_of_origin: initial.country_of_origin ?? "",
        currency: (initial.currency as "AFN" | "USD") ?? "AFN",
        description: initial.description ?? "",
        hs_code: initial.hs_code ?? "",
        low_stock_threshold: initial.low_stock_threshold,
        min_sale_qty: initial.min_sale_qty ?? 1,
        model_number: initial.model_number ?? "",
        name: initial.name,
        product_type:
          (initial.product_type as ProductWriteFormInput["product_type"]) ??
          "consumable",
        requires_license: Boolean(initial.requires_license),
        sale_price: initial.sale_price,
        sku: initial.sku ?? "",
        tracking_mode:
          (initial.tracking_mode as ProductWriteFormInput["tracking_mode"]) ??
          "none",
        unit_of_measure: initial.unit_of_measure ?? "piece",
        warranty_months: initial.warranty_months ?? undefined,
      });
    } else {
      reset({
        barcode: "",
        brand_id: undefined,
        category_id: undefined,
        condition: "new",
        cost_price: 0,
        country_of_origin: "",
        currency: "AFN",
        description: "",
        hs_code: "",
        low_stock_threshold: 0,
        min_sale_qty: 1,
        model_number: "",
        name: "",
        opening_qty: 0,
        product_type: "consumable",
        requires_license: false,
        sale_price: 0,
        sku: "",
        tracking_mode: "none",
        unit_of_measure: "piece",
        warranty_months: undefined,
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
      toastSuccess(
        t(mode === "create" ? "common.toast.created" : "common.toast.updated")
      );
      onSaved();
      onClose();
    } catch (e: unknown) {
      toastTranslatedError(t, e);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
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
          <Tabs defaultValue="basic">
            <TabsList className="mb-4">
              <TabsTrigger type="button" value="basic">
                {t("products.tabBasic")}
              </TabsTrigger>
              <TabsTrigger type="button" value="catalog">
                {t("products.tabCatalog")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="basic">
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
                    onValueChange={(v) =>
                      setValue("currency", v as "AFN" | "USD")
                    }
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
            </TabsContent>
            <TabsContent value="catalog">
              <FieldGroup>
                <Field>
                  <Label>{t("products.type")}</Label>
                  <Select
                    onValueChange={(value) =>
                      setValue(
                        "product_type",
                        value as ProductWriteFormInput["product_type"]
                      )
                    }
                    value={productType}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`products.type.${type}` as never)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <Label>{t("products.tracking")}</Label>
                  <Select
                    onValueChange={(value) =>
                      setValue(
                        "tracking_mode",
                        value as ProductWriteFormInput["tracking_mode"]
                      )
                    }
                    value={trackingMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRACKING_MODES.map((modeValue) => (
                        <SelectItem key={modeValue} value={modeValue}>
                          {t(`products.tracking.${modeValue}` as never)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <Label>{t("products.category")}</Label>
                  <Select
                    onValueChange={(value) =>
                      setValue(
                        "category_id",
                        value === "__none__" ? undefined : value
                      )
                    }
                    value={watch("category_id") ?? "__none__"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <Label>{t("products.brand")}</Label>
                  <Select
                    onValueChange={(value) =>
                      setValue(
                        "brand_id",
                        value === "__none__" ? undefined : value
                      )
                    }
                    value={watch("brand_id") ?? "__none__"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <Label>{t("products.modelNumber")}</Label>
                  <Input {...register("model_number")} />
                </Field>
                <Field>
                  <Label>{t("products.countryOfOrigin")}</Label>
                  <Input {...register("country_of_origin")} />
                </Field>
                <Field>
                  <Label>{t("products.hsCode")}</Label>
                  <Input {...register("hs_code")} />
                </Field>
                <Field>
                  <Label>{t("products.warrantyMonths")}</Label>
                  <Input
                    min={0}
                    type="number"
                    {...numberField("warranty_months")}
                  />
                </Field>
                <Field>
                  <Label>{t("products.unitOfMeasure")}</Label>
                  <Input {...register("unit_of_measure")} />
                </Field>
                <Field>
                  <Label>{t("products.description")}</Label>
                  <Textarea {...register("description")} rows={3} />
                </Field>
              </FieldGroup>
            </TabsContent>
          </Tabs>
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
