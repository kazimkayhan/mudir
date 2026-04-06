/** هم‌تراز با فرمول `createSaleAtomic` برای نمایش سبد POS. */
export function computePosTotals(
  lines: { quantity: number; unitPrice: number }[],
  discountAmount: number,
  taxAmount: number,
): { subtotal: number; total: number } {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  );
  const total = Math.max(0, subtotal - discountAmount + taxAmount);
  return { subtotal, total };
}
