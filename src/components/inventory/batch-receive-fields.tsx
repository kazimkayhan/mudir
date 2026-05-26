"use client";

import type { ProductRow } from "@/bridge/products";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/hooks";

export interface SerialSlot {
  id: string;
  value: string;
}

export interface ReceiveLineMeta {
  expiryDate?: string;
  lotNumber?: string;
  serialSlots: SerialSlot[];
}

interface BatchReceiveFieldsProps {
  meta: ReceiveLineMeta;
  onChange: (meta: ReceiveLineMeta) => void;
  product: ProductRow;
}

export function BatchReceiveFields({
  meta,
  onChange,
  product,
}: BatchReceiveFieldsProps) {
  const { t } = useI18n();
  const mode = product.tracking_mode;

  if (mode === "none") {
    return null;
  }

  if (mode === "serial") {
    return (
      <div className="space-y-2 rounded-md border bg-muted/30 p-3">
        <p className="font-medium text-xs">{t("inventory.serialNumbers")}</p>
        {meta.serialSlots.map((slot, index) => (
          <Field key={slot.id}>
            <Label>{`${t("inventory.serial")} ${index + 1}`}</Label>
            <Input
              onChange={(e) => {
                const serialSlots = meta.serialSlots.map((entry) =>
                  entry.id === slot.id
                    ? { ...entry, value: e.target.value }
                    : entry
                );
                onChange({ ...meta, serialSlots });
              }}
              value={slot.value}
            />
          </Field>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <Field>
        <Label>{t("inventory.lotNumber")}</Label>
        <Input
          onChange={(e) => onChange({ ...meta, lotNumber: e.target.value })}
          value={meta.lotNumber ?? ""}
        />
      </Field>
      {mode === "lot_expiry" ? (
        <Field>
          <Label>{t("inventory.expiryDate")}</Label>
          <Input
            onChange={(e) => onChange({ ...meta, expiryDate: e.target.value })}
            type="date"
            value={meta.expiryDate ?? ""}
          />
        </Field>
      ) : null}
    </div>
  );
}
