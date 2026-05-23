import { describe, expect, it } from "vitest";
import { convertToAfn, formatMoney, roundMoney } from "@/lib/format";

describe("format", () => {
  it("rounds half-up to 2 decimals", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(1.004)).toBe(1);
  });

  it("formats AFN in Dari locale", () => {
    const s = formatMoney(1250.5, "AFN", "fa-AF");
    expect(s).toContain("افغانی");
  });

  it("formats USD", () => {
    expect(formatMoney(25, "USD", "en")).toBe("$25.00");
  });

  it("converts USD to AFN", () => {
    expect(convertToAfn(10, "USD", 70)).toBe(700);
  });
});
