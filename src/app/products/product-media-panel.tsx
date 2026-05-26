"use client";

import { Plus, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  addProductDocument,
  addProductImage,
  addProductKitItem,
  deleteProductDocument,
  deleteProductImage,
  listProductDocuments,
  listProductImages,
  listProductKitItems,
  type ProductDocumentRow,
  type ProductImageRow,
  type ProductKitRow,
  pickAndCopyProductAsset,
  removeProductKitItem,
} from "@/bridge/product-media";
import { listProducts, type ProductRow } from "@/bridge/products";
import { AssetPreview } from "@/components/asset-preview";
import { ProductCombobox } from "@/components/product-combobox";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n/hooks";
import { toastSuccess, toastTranslatedError } from "@/lib/app-toast";
import { isMudirDesktop } from "@/lib/runtime";

interface ProductMediaPanelProps {
  product: ProductRow;
}

export function ProductMediaPanel({ product }: ProductMediaPanelProps) {
  const { t } = useI18n();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [kitItems, setKitItems] = useState<ProductKitRow[]>([]);
  const [documents, setDocuments] = useState<ProductDocumentRow[]>([]);
  const [images, setImages] = useState<ProductImageRow[]>([]);
  const [componentId, setComponentId] = useState("");
  const [componentQty, setComponentQty] = useState(1);
  const [docTitle, setDocTitle] = useState("");

  const refresh = useCallback(async () => {
    const [allProducts, kits, docs, imgs] = await Promise.all([
      listProducts(),
      listProductKitItems(product.id),
      listProductDocuments(product.id),
      listProductImages(product.id),
    ]);
    setProducts(allProducts);
    setKitItems(kits);
    setDocuments(docs);
    setImages(imgs);
  }, [product.id]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const addKit = async () => {
    if (!componentId) {
      return;
    }
    try {
      await addProductKitItem({
        componentProductId: componentId,
        kitProductId: product.id,
        quantity: componentQty,
      });
      setComponentId("");
      setComponentQty(1);
      await refresh();
      toastSuccess(t("common.toast.created"));
    } catch (e: unknown) {
      toastTranslatedError(t, e);
    }
  };

  const addDocument = async () => {
    try {
      const path = await pickAndCopyProductAsset(product.id, "document");
      if (!path) {
        return;
      }
      await addProductDocument({
        docType: "manual",
        filePath: path,
        productId: product.id,
        title: docTitle.trim() || t("products.document"),
      });
      setDocTitle("");
      await refresh();
      toastSuccess(t("common.toast.created"));
    } catch (e: unknown) {
      toastTranslatedError(t, e);
    }
  };

  const addImage = async () => {
    try {
      const path = await pickAndCopyProductAsset(product.id, "image");
      if (!path) {
        return;
      }
      await addProductImage({
        filePath: path,
        productId: product.id,
        sortOrder: images.length,
      });
      await refresh();
      toastSuccess(t("common.toast.created"));
    } catch (e: unknown) {
      toastTranslatedError(t, e);
    }
  };

  return (
    <div className="space-y-8">
      {product.product_type === "kit" ? (
        <section>
          <h3 className="mb-3 font-medium">{t("products.kitComponents")}</h3>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <ProductCombobox
              allowNone
              onValueChange={setComponentId}
              products={products.filter((p) => p.id !== product.id)}
              triggerClassName="min-w-[12rem]"
              value={componentId}
            />
            <NumberInput
              aria-label={t("common.qty")}
              className="w-20"
              onValueChange={setComponentQty}
              value={componentQty}
            />
            <Button
              data-icon="inline-start"
              disabled={!(componentId && isMudirDesktop())}
              onClick={() => {
                addKit().catch(() => undefined);
              }}
              type="button"
            >
              <Plus aria-hidden />
              {t("common.add")}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("nav.products")}</TableHead>
                <TableHead>{t("common.qty")}</TableHead>
                <TableHead>{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kitItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.component_name ?? item.component_product_id}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>
                    <Button
                      data-icon="inline-start"
                      onClick={() => {
                        removeProductKitItem(item.id)
                          .then(() => {
                            toastSuccess(t("common.toast.deleted"));
                            return refresh();
                          })
                          .catch((e: unknown) => toastTranslatedError(t, e));
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden />
                      {t("common.delete")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <section>
        <h3 className="mb-3 font-medium">{t("products.images")}</h3>
        <div className="mb-3 flex flex-wrap gap-3">
          {images.map((image) => (
            <div
              className="flex flex-col items-center gap-2 rounded-xl border p-2"
              key={image.id}
            >
              <AssetPreview
                imageClassName="rounded-lg object-cover"
                path={image.file_path}
                variant="thumbnail"
              />
              <Button
                onClick={() => {
                  deleteProductImage(image.id)
                    .then(() => {
                      toastSuccess(t("common.toast.deleted"));
                      return refresh();
                    })
                    .catch((e: unknown) => toastTranslatedError(t, e));
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t("common.delete")}
              </Button>
            </div>
          ))}
        </div>
        <Button
          data-icon="inline-start"
          disabled={!isMudirDesktop()}
          onClick={() => {
            addImage().catch(() => undefined);
          }}
          type="button"
          variant="outline"
        >
          <Upload aria-hidden />
          {t("products.addImage")}
        </Button>
      </section>

      <section>
        <h3 className="mb-3 font-medium">{t("products.documents")}</h3>
        <Field className="mb-3 max-w-sm">
          <Label>{t("products.documentTitle")}</Label>
          <Input
            onChange={(e) => setDocTitle(e.target.value)}
            value={docTitle}
          />
        </Field>
        <Button
          className="mb-3"
          data-icon="inline-start"
          disabled={!isMudirDesktop()}
          onClick={() => {
            addDocument().catch(() => undefined);
          }}
          type="button"
          variant="outline"
        >
          <Upload aria-hidden />
          {t("products.addDocument")}
        </Button>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("validation.nameRequired")}</TableHead>
              <TableHead>{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>{doc.title}</TableCell>
                <TableCell>
                  <Button
                    onClick={() => {
                      deleteProductDocument(doc.id)
                        .then(() => {
                          toastSuccess(t("common.toast.deleted"));
                          return refresh();
                        })
                        .catch((e: unknown) => toastTranslatedError(t, e));
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {t("common.delete")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
