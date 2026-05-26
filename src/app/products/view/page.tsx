"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ProductMediaPanel } from "@/app/products/product-media-panel";
import { listBatches } from "@/bridge/batches";
import { getProductById, type ProductRow } from "@/bridge/products";
import { PageTitle } from "@/components/app-icons";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/hooks";
import { formatMoney } from "@/lib/format";

function ProductDetailContent() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const productId = searchParams.get("id")?.trim() ?? "";
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [batches, setBatches] = useState<
    {
      id: string;
      serial_number: string | null;
      lot_number: string | null;
      qty_on_hand: number;
      expiry_date: string | null;
    }[]
  >([]);

  useEffect(() => {
    if (!productId) {
      setProduct(null);
      setBatches([]);
      return;
    }
    Promise.all([getProductById(productId), listBatches(productId)])
      .then(([p, b]) => {
        setProduct(p);
        setBatches(b);
      })
      .catch(() => undefined);
  }, [productId]);

  if (!productId) {
    return (
      <main className="mx-auto max-w-4xl px-6 pb-6">
        <p className="mt-8 text-muted-foreground text-sm">
          {t("common.empty")}
        </p>
        <Button asChild className="mt-4" type="button" variant="outline">
          <Link href="/products">{t("common.back")}</Link>
        </Button>
      </main>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 pb-6">
      <PageHeader>
        <div className="flex items-center justify-between gap-4">
          <PageTitle href="/products">{product.name}</PageTitle>
          <Button asChild type="button" variant="outline">
            <Link href="/products">{t("common.back")}</Link>
          </Button>
        </div>
      </PageHeader>

      <Tabs className="mt-4" defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("products.detail")}</TabsTrigger>
          <TabsTrigger value="stock">{t("nav.inventory")}</TabsTrigger>
          <TabsTrigger value="media">{t("products.media")}</TabsTrigger>
        </TabsList>
        <TabsContent className="mt-4 space-y-2" value="overview">
          <p className="text-sm">
            {t("common.sku")}: {product.sku ?? "—"}
          </p>
          <p className="text-sm">
            {t("products.salePrice")}:{" "}
            {formatMoney(product.sale_price, product.currency as "AFN", locale)}
          </p>
          <p className="text-sm">
            {t("products.tracking")}: {product.tracking_mode}
          </p>
          <p className="text-sm">
            {t("products.type")}: {product.product_type}
          </p>
          {product.model_number ? (
            <p className="text-sm">
              {t("products.modelNumber")}: {product.model_number}
            </p>
          ) : null}
          {product.description ? (
            <p className="text-sm">{product.description}</p>
          ) : null}
          <p className="text-sm">
            {t("common.qty")}: {product.on_hand_qty}
          </p>
          <Badge variant="outline">{product.condition}</Badge>
        </TabsContent>
        <TabsContent className="mt-4" value="media">
          <ProductMediaPanel product={product} />
        </TabsContent>
        <TabsContent value="stock">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("products.tracking")}</TableHead>
                <TableHead>{t("common.qty")}</TableHead>
                <TableHead>{t("dashboard.expiringLots")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    {b.serial_number ?? b.lot_number ?? "—"}
                  </TableCell>
                  <TableCell>{b.qty_on_hand}</TableCell>
                  <TableCell>{b.expiry_date ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </main>
  );
}

export default function ProductViewPage() {
  return (
    <Suspense fallback={null}>
      <ProductDetailContent />
    </Suspense>
  );
}
