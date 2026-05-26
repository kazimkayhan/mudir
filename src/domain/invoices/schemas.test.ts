import { describe, expect, it } from "vitest";
import {
  computeInvoiceTotals,
  deriveInvoiceStatus,
} from "@/domain/invoices/schemas";

describe("invoice totals", () => {
  it("computes subtotal and total", () => {
    const result = computeInvoiceTotals({
      discountAmount: 10,
      items: [{ quantity: 2, unitPrice: 100 }],
      taxAmount: 5,
    });
    expect(result.subtotal).toBe(200);
    expect(result.total).toBe(195);
  });

  it("derives paid status", () => {
    expect(deriveInvoiceStatus(100, 100, undefined, "issued")).toBe("paid");
    expect(deriveInvoiceStatus(100, 50, undefined, "issued")).toBe("partial");
  });
});
