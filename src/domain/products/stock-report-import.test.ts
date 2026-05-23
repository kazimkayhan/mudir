import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  parsePowerLightStockReportLine,
  parsePowerLightStockReportText,
  stockReportRowToProductInput,
} from "@/domain/products/stock-report-import";

describe("parsePowerLightStockReportLine", () => {
  test("parses a standard POWER LIGHT row", () => {
    const row = parsePowerLightStockReportLine(
      "201 BATTERY 200AH KAN 7\t4 0 1,085.00 1,085.00\t0.00 0.00\tBATTERY FLD 0.00"
    );
    expect(row).toMatchObject({
      code: "4",
      costPrice: 155,
      name: "BATTERY 200AH KAN",
      productGroup: "BATTERY FLD",
      quantity: 7,
      rowNumber: 201,
      total: 1085,
    });
  });

  test("derives unit cost from total when cost price is zero", () => {
    const row = parsePowerLightStockReportLine(
      "75 Cable Camera 196\t21 0 49.00 49.00\t49.00 49.00\tCAMERA 0.25"
    );
    expect(row?.costPrice).toBe(0.25);
    expect(row?.quantity).toBe(196);
  });

  test("parses rows without a leading report number", () => {
    const row = parsePowerLightStockReportLine(
      "200ah battery 200ah altima 11\t7 0 1,815.00 1,815.00\t0.00 0.00\tBATTERY FLD 0.00"
    );
    expect(row?.name).toBe("200ah battery 200ah altima");
    expect(row?.quantity).toBe(11);
  });
});

describe("parsePowerLightStockReportText", () => {
  test("parses the attached stock PDF sample", async () => {
    const { PDFParse } = await import("pdf-parse");
    const pdfPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../Stock-2026-05-21.pdf"
    );
    const parser = new PDFParse({ data: readFileSync(pdfPath) });
    const text = (await parser.getText()).text;
    await parser.destroy();

    const result = parsePowerLightStockReportText(text);
    expect(result.rows.length).toBeGreaterThanOrEqual(210);
    expect(result.skippedLines).toBeLessThanOrEqual(2);
  });
});

describe("stockReportRowToProductInput", () => {
  test("maps report row to product write input", () => {
    const row = parsePowerLightStockReportLine(
      "38 Camera XS T60 1\t32 0 22.00 22.00\t22.00 22.00\tCAMERA 22.00"
    );
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }
    const product = stockReportRowToProductInput(row, {
      currency: "USD",
      salePriceMode: "same_as_cost",
    });
    expect(product).toMatchObject({
      cost_price: 22,
      currency: "USD",
      name: "Camera XS T60",
      opening_qty: 1,
      sale_price: 22,
      sku: "32",
    });
  });
});
