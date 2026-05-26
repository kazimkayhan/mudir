export function allocateLandedCostByValue(
  lines: { quantity: number; unitCost: number }[],
  shipmentCosts: number
): number[] {
  const baseTotal = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitCost,
    0
  );
  if (baseTotal <= 0 || shipmentCosts <= 0) {
    return lines.map(() => 0);
  }
  return lines.map((line) => {
    const lineValue = line.quantity * line.unitCost;
    return (lineValue / baseTotal) * shipmentCosts;
  });
}

export function landedUnitCost(
  unitCost: number,
  quantity: number,
  allocatedCost: number
): number {
  if (quantity <= 0) {
    return unitCost;
  }
  return unitCost + allocatedCost / quantity;
}
