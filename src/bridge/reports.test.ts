import { describe, expect, it } from "vitest";
import { salesCsvWithBom } from "@/bridge/reports";

describe("salesCsvWithBom", () => {
  it("prefixes UTF-8 BOM for Excel", () => {
    const csv = salesCsvWithBom([
      { day: "2026-05-01", total: 100 },
      { day: "2026-05-02", total: 50 },
    ]);
    expect(csv.startsWith("\uFEFFday,total")).toBe(true);
    expect(csv).toContain("2026-05-01,100");
  });
});
