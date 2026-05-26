"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listCustomers } from "@/bridge/customers";
import { createInvoice } from "@/bridge/invoices";
import { listProducts } from "@/bridge/products";
import { PageTitle } from "@/components/app-icons";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n/hooks";
import { invoiceDetailHref } from "@/lib/entity-routes";

export default function NewInvoicePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>(
    []
  );
  const [products, setProducts] = useState<
    { id: string; name: string; sale_price: number }[]
  >([]);
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([listCustomers(), listProducts()])
      .then(([c, p]) => {
        setCustomers(c);
        setProducts(p);
      })
      .catch(() => undefined);
  }, []);

  const submit = async () => {
    if (!(customerId && productId)) {
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (!product) {
      return;
    }
    setBusy(true);
    try {
      const { id } = await createInvoice({
        customer_id: customerId,
        items: [
          {
            product_id: productId,
            quantity: 1,
            unit_price: product.sale_price,
          },
        ],
      });
      router.push(invoiceDetailHref(id));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-6 pb-6">
      <PageHeader>
        <PageTitle href="/invoices">{t("invoices.new")}</PageTitle>
      </PageHeader>
      <div className="mt-6 space-y-4">
        <Field>
          <Label>{t("invoices.customer")}</Label>
          <Select onValueChange={setCustomerId} value={customerId}>
            <SelectTrigger>
              <SelectValue placeholder={t("invoices.customer")} />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <Label>{t("nav.products")}</Label>
          <Select onValueChange={setProductId} value={productId}>
            <SelectTrigger>
              <SelectValue placeholder={t("nav.products")} />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button
            disabled={busy}
            onClick={() => submit().catch(() => undefined)}
            type="button"
          >
            {t("common.save")}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/invoices">{t("common.cancel")}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
