"use client";

import { ChevronsUpDownIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { ProductRow } from "@/bridge/products";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslations } from "@/i18n/hooks";
import { cn } from "@/lib/utils";

function productSearchValue(product: ProductRow): string {
  return [product.id, product.name, product.sku, product.barcode]
    .filter((part) => part != null && String(part).length > 0)
    .join(" ");
}

interface ProductComboboxProps {
  allowNone?: boolean;
  className?: string;
  disabled?: boolean;
  id?: string;
  onValueChange: (productId: string) => void;
  placeholder?: string;
  products: ProductRow[];
  showStock?: boolean;
  triggerClassName?: string;
  value: string;
}

export function ProductCombobox({
  allowNone = false,
  className,
  disabled = false,
  id,
  onValueChange,
  placeholder,
  products,
  showStock = false,
  triggerClassName,
  value,
}: ProductComboboxProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => products.find((product) => product.id === value),
    [products, value]
  );

  const formatLabel = (product: ProductRow) => {
    if (showStock) {
      return `${product.name} (${t("products.onHand")} ${product.on_hand_qty})`;
    }
    return product.name;
  };

  let triggerLabel = placeholder ?? t("products.search");
  if (selected) {
    triggerLabel = formatLabel(selected);
  } else if (!placeholder && allowNone) {
    triggerLabel = t("common.none");
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between rounded-3xl border border-transparent bg-input/50 px-3 font-normal hover:bg-input/50",
            !selected && "text-muted-foreground",
            triggerClassName
          )}
          disabled={disabled}
          id={id}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("p-0", className)}>
        <Command>
          <CommandInput placeholder={t("products.search")} />
          <CommandList>
            <CommandEmpty>{t("products.empty")}</CommandEmpty>
            <CommandGroup>
              {allowNone ? (
                <CommandItem
                  onSelect={() => {
                    onValueChange("");
                    setOpen(false);
                  }}
                  value="__none__"
                >
                  {t("common.none")}
                </CommandItem>
              ) : null}
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  onSelect={() => {
                    onValueChange(product.id);
                    setOpen(false);
                  }}
                  value={productSearchValue(product)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{product.name}</div>
                    {product.sku || product.barcode ? (
                      <div className="truncate text-muted-foreground text-xs">
                        {[product.sku, product.barcode]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    ) : null}
                    {showStock ? (
                      <div className="text-muted-foreground text-xs">
                        {t("products.onHand")} {product.on_hand_qty}
                      </div>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
