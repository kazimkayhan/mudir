import type { ProductWriteInput } from "@/domain/products/schemas";

const COMMA_REGEX = /,/g;
const WITH_ROW_REGEX = /^(\d+)\s+(.+?)\s+(\d+)$/;
const WITHOUT_ROW_REGEX = /^(.+?)\s+(\d+)$/;
const WHITESPACE_SPLIT_REGEX = /\s+/;
const COST_PRICE_REGEX = /^(.+?)\s+([\d,.]+)$/;
const LINE_BREAK_REGEX = /\r?\n/;
const BOM_REGEX = /^\uFEFF/;
const NORMALIZE_WHITESPACE_REGEX = /\s+/g;

export interface StockReportImportRow {
  code: string;
  costPrice: number;
  name: string;
  productGroup: string;
  quantity: number;
  rowNumber: number | null;
  sourceLine: string;
  total: number;
}

export interface StockReportParseResult {
  rows: StockReportImportRow[];
  skippedLines: number;
}

export interface StockReportImportOptions {
  currency: "AFN" | "USD";
  salePriceMode: "same_as_cost" | "zero";
}

function parseDecimal(value: string): number {
  return Number(value.replace(COMMA_REGEX, ""));
}

function parsePart1(part: string): {
  rowNumber: number | null;
  name: string;
  quantity: number;
} | null {
  const withRow = part.match(WITH_ROW_REGEX);
  if (withRow) {
    return {
      name: withRow[2].trim(),
      quantity: Number.parseInt(withRow[3], 10),
      rowNumber: Number.parseInt(withRow[1], 10),
    };
  }
  const withoutRow = part.match(WITHOUT_ROW_REGEX);
  if (withoutRow) {
    return {
      name: withoutRow[1].trim(),
      quantity: Number.parseInt(withoutRow[2], 10),
      rowNumber: null,
    };
  }
  return null;
}

function parsePart2(part: string): {
  code: string;
  total: number;
} | null {
  const tokens = part.trim().split(WHITESPACE_SPLIT_REGEX);
  if (tokens.length === 3) {
    return {
      code: tokens[0],
      total: parseDecimal(tokens[2]),
    };
  }
  if (tokens.length >= 4) {
    return {
      code: tokens[0],
      total: parseDecimal(tokens.at(-1) ?? "0"),
    };
  }
  return null;
}

function parsePart4(part: string): {
  productGroup: string;
  costPrice: number;
} | null {
  const match = part.match(COST_PRICE_REGEX);
  if (!match) {
    return null;
  }
  return {
    costPrice: parseDecimal(match[2]),
    productGroup: match[1].trim(),
  };
}

function isDataLine(line: string): boolean {
  if (!line.includes("\t")) {
    return false;
  }
  if (line.includes("Total before tax")) {
    return false;
  }
  if (line.startsWith("Page ") || line.startsWith("--")) {
    return false;
  }
  return true;
}

export function parsePowerLightStockReportLine(
  line: string
): StockReportImportRow | null {
  const parts = line.split("\t");
  if (parts.length < 4) {
    return null;
  }
  const part1 = parsePart1(parts[0].trim());
  const part2 = parsePart2(parts[1]);
  const part4 = parsePart4(parts[3].trim());
  if (!(part1 && part2 && part4)) {
    return null;
  }

  let costPrice = part4.costPrice;
  if (costPrice === 0 && part1.quantity > 0 && part2.total > 0) {
    costPrice = part2.total / part1.quantity;
  }

  return {
    code: part2.code,
    costPrice: roundMoney(costPrice),
    name: part1.name,
    productGroup: part4.productGroup,
    quantity: part1.quantity,
    rowNumber: part1.rowNumber,
    sourceLine: line,
    total: part2.total,
  };
}

export function parsePowerLightStockReportText(
  text: string
): StockReportParseResult {
  const rows: StockReportImportRow[] = [];
  let skippedLines = 0;

  for (const rawLine of text.split(LINE_BREAK_REGEX)) {
    const line = rawLine.trim();
    if (!isDataLine(line)) {
      continue;
    }
    const parsed = parsePowerLightStockReportLine(line);
    if (!parsed) {
      skippedLines += 1;
      continue;
    }
    rows.push(parsed);
  }

  return { rows, skippedLines };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function stockReportRowToProductInput(
  row: StockReportImportRow,
  options: StockReportImportOptions
): ProductWriteInput {
  const salePrice =
    options.salePriceMode === "same_as_cost" ? row.costPrice : 0;

  return {
    condition: "new",
    cost_price: row.costPrice,
    currency: options.currency,
    low_stock_threshold: 0,
    min_sale_qty: 1,
    name: row.name,
    opening_qty: row.quantity,
    product_type: "consumable",
    requires_license: false,
    sale_price: salePrice,
    sku: row.code,
    tracking_mode: "none",
    unit_of_measure: "piece",
  };
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(NORMALIZE_WHITESPACE_REGEX, " ");
}

interface CsvColumnIndices {
  codeIdx: number;
  costIdx: number;
  groupIdx: number;
  nameIdx: number;
  qtyIdx: number;
  totalIdx: number;
}

function findCsvColumnIndices(headers: string[]): CsvColumnIndices {
  const indexOf = (...names: string[]) => {
    for (const name of names) {
      const idx = headers.indexOf(normalizeHeader(name));
      if (idx >= 0) {
        return idx;
      }
    }
    return -1;
  };

  return {
    codeIdx: indexOf("code"),
    costIdx: indexOf("cost price", "cost_price"),
    groupIdx: indexOf("product group", "group"),
    nameIdx: indexOf("product"),
    qtyIdx: indexOf("qty.", "qty", "quantity"),
    totalIdx: indexOf("total", "total before tax"),
  };
}

function parseCsvDataLine(
  line: string,
  delimiter: string,
  indices: CsvColumnIndices
): StockReportImportRow | null {
  const cells = line.split(delimiter).map((cell) => cell.trim());
  const code = cells[indices.codeIdx] ?? "";
  const name = cells[indices.nameIdx] ?? "";
  const quantity = Number.parseInt(cells[indices.qtyIdx] ?? "0", 10);
  if (!name || Number.isNaN(quantity)) {
    return null;
  }

  const total =
    indices.totalIdx >= 0 ? parseDecimal(cells[indices.totalIdx] || "0") : 0;
  let costPrice =
    indices.costIdx >= 0 ? parseDecimal(cells[indices.costIdx] || "0") : 0;
  if (costPrice === 0 && quantity > 0 && total > 0) {
    costPrice = total / quantity;
  }

  return {
    code,
    costPrice: roundMoney(costPrice),
    name,
    productGroup: indices.groupIdx >= 0 ? (cells[indices.groupIdx] ?? "") : "",
    quantity,
    rowNumber: null,
    sourceLine: line,
    total,
  };
}

export function parseStockReportCsv(text: string): StockReportParseResult {
  const lines = text
    .replace(BOM_REGEX, "")
    .split(LINE_BREAK_REGEX)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { rows: [], skippedLines: 0 };
  }

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map(normalizeHeader);
  const indices = findCsvColumnIndices(headers);

  if (indices.codeIdx < 0 || indices.nameIdx < 0 || indices.qtyIdx < 0) {
    throw new Error("products.import.invalidCsv");
  }

  const rows: StockReportImportRow[] = [];
  let skippedLines = 0;

  for (const line of lines.slice(1)) {
    const parsed = parseCsvDataLine(line, delimiter, indices);
    if (!parsed) {
      skippedLines += 1;
      continue;
    }
    rows.push(parsed);
  }

  return { rows, skippedLines };
}
