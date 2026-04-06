"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  insertProduct,
  type ProductRow,
  updateProduct,
} from "@/bridge/products";
import {
  type ProductWriteInput,
  productWriteSchema,
} from "@/domain/products/schemas";

type ProductEditorDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initial: ProductRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ProductEditorDialog({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: ProductEditorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const nameId = useId();
  const skuId = useId();
  const qtyId = useId();
  const errId = useId();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductWriteInput>({
    resolver: zodResolver(productWriteSchema),
    defaultValues: {
      name: "",
      sku: "",
      on_hand_qty: 0,
    },
  });

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) {
      return;
    }
    if (open) {
      el.showModal();
    } else {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSubmitError(null);
    if (mode === "edit" && initial) {
      reset({
        name: initial.name,
        sku: initial.sku ?? "",
        on_hand_qty: initial.on_hand_qty,
      });
    } else {
      reset({ name: "", sku: "", on_hand_qty: 0 });
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
      setSubmitError(e instanceof Error ? e.message : String(e));
    }
  });

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={submitError ? errId : undefined}
      className="w-[min(100vw-2rem,26rem)] max-w-none rounded-lg border border-neutral-200 bg-[var(--background)] p-0 text-[var(--foreground)] shadow-xl backdrop:bg-black/40 dark:border-neutral-800"
      onCancel={(ev) => {
        ev.preventDefault();
        onClose();
      }}
    >
      <form className="flex flex-col gap-3 p-4" onSubmit={onSubmit}>
        <h2 className="font-semibold text-lg" id={titleId}>
          {mode === "create" ? "New product" : "Edit product"}
        </h2>

        {submitError ? (
          <p className="text-red-600 text-sm dark:text-red-400" id={errId}>
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-col gap-1">
          <label
            className="text-neutral-600 text-xs dark:text-neutral-400"
            htmlFor={nameId}
          >
            Name
          </label>
          <input
            id={nameId}
            type="text"
            autoComplete="off"
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600"
            aria-invalid={errors.name ? true : undefined}
            {...register("name")}
          />
          {errors.name ? (
            <span className="text-red-600 text-xs">{errors.name.message}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-neutral-600 text-xs dark:text-neutral-400"
            htmlFor={skuId}
          >
            SKU (optional)
          </label>
          <input
            id={skuId}
            type="text"
            autoComplete="off"
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600"
            {...register("sku")}
          />
          {errors.sku ? (
            <span className="text-red-600 text-xs">{errors.sku.message}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-neutral-600 text-xs dark:text-neutral-400"
            htmlFor={qtyId}
          >
            On-hand qty
          </label>
          <input
            id={qtyId}
            type="number"
            min={0}
            step={1}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600"
            aria-invalid={errors.on_hand_qty ? true : undefined}
            {...register("on_hand_qty", { valueAsNumber: true })}
          />
          {errors.on_hand_qty ? (
            <span className="text-red-600 text-xs">
              {errors.on_hand_qty.message}
            </span>
          ) : null}
        </div>

        <p className="text-neutral-500 text-xs dark:text-neutral-500">
          MVP: qty is stored on the product row. Later, only stock movements
          will change on-hand.
        </p>

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600"
            onClick={() => {
              onClose();
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
