/** Parse a number field value; empty or invalid input becomes `fallback` (default 0). */
export function parseNumberInput(value: string, fallback = 0): number {
  const trimmed = value.trim();
  if (trimmed === "") {
    return fallback;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}
