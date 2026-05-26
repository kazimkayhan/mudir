"use client";

import { useEffect, useState } from "react";
import { type BatchRow, listBatches } from "@/bridge/batches";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/hooks";

interface BatchPickerDialogProps {
  onClose: () => void;
  onSelect: (batch: BatchRow) => void;
  open: boolean;
  productId: string;
  productName: string;
  trackingMode: string;
}

export function BatchPickerDialog({
  onClose,
  onSelect,
  open,
  productId,
  productName,
  trackingMode,
}: BatchPickerDialogProps) {
  const { t } = useI18n();
  const [batches, setBatches] = useState<BatchRow[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    listBatches(productId)
      .then((rows) =>
        setBatches(
          rows.filter((b) => b.status === "available" && b.qty_on_hand > 0)
        )
      )
      .catch(() => setBatches([]));
  }, [open, productId]);

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
          <DialogTitle>{t("inventory.selectBatch")}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">{productName}</p>
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {batches.length === 0 ? (
            <li className="text-muted-foreground text-sm">
              {t("common.empty")}
            </li>
          ) : (
            batches.map((batch) => (
              <li key={batch.id}>
                <Button
                  className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                  onClick={() => {
                    onSelect(batch);
                    onClose();
                  }}
                  type="button"
                  variant="outline"
                >
                  <span className="font-mono text-xs">
                    {trackingMode === "serial"
                      ? batch.serial_number
                      : (batch.lot_number ??
                        batch.serial_number ??
                        batch.id.slice(0, 8))}
                    {batch.expiry_date ? ` · ${batch.expiry_date}` : null}
                    {" · "}
                    {t("common.qty")}: {batch.qty_on_hand}
                  </span>
                </Button>
              </li>
            ))
          )}
        </ul>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
