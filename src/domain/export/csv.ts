const CSV_ESCAPE_REGEX = /[",\n\r]/;

export function escapeCsvCell(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (CSV_ESCAPE_REGEX.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rowsToCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const bom = "\uFEFF";
  const headerLine = headers.map((h) => escapeCsvCell(h)).join(",");
  const body = rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
  return `${bom}${headerLine}\n${body}`;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
