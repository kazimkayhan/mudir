import { describe, expect, it } from "vitest";
import { sumPaymentsInSaleCurrency } from "@/lib/payment-totals";

describe("sumPaymentsInSaleCurrency", () => {
  it("sums same-currency payments", () => {
    expect(
      sumPaymentsInSaleCurrency(
        [
          { amount: 100, currencyCode: "AFN", method: "cash" },
          { amount: 50, currencyCode: "AFN", method: "cash" },
        ],
        "AFN",
        70
      )
    ).toBe(150);
  });

  it("converts USD into AFN sale total", () => {
    expect(
      sumPaymentsInSaleCurrency(
        [{ amount: 10, currencyCode: "USD", method: "cash" }],
        "AFN",
        70
      )
    ).toBe(700);
  });
});
