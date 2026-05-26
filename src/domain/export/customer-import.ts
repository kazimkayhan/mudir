export interface CustomerImportRow {
  address: string;
  name: string;
  note: string;
  phone: string;
  sourceLine: number;
}

const BOM_REGEX = /^\uFEFF/;
const LINE_BREAK_REGEX = /\r?\n/;

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function parseCustomerImportCsv(text: string): CustomerImportRow[] {
  const lines = text
    .replace(BOM_REGEX, "")
    .split(LINE_BREAK_REGEX)
    .filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const nameIndex = headers.indexOf("name");
  if (nameIndex === -1) {
    throw new Error("data.import.customers.invalidCsv");
  }

  const phoneIndex = headers.indexOf("phone");
  const addressIndex = headers.indexOf("address");
  const noteIndex = headers.indexOf("note");

  const rows: CustomerImportRow[] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = splitCsvLine(lines[lineIndex]);
    const name = cells[nameIndex]?.trim() ?? "";
    if (!name) {
      continue;
    }
    rows.push({
      address: addressIndex >= 0 ? (cells[addressIndex]?.trim() ?? "") : "",
      name,
      note: noteIndex >= 0 ? (cells[noteIndex]?.trim() ?? "") : "",
      phone: phoneIndex >= 0 ? (cells[phoneIndex]?.trim() ?? "") : "",
      sourceLine: lineIndex + 1,
    });
  }
  return rows;
}
