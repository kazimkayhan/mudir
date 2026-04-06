import { describe, expect, test } from "vitest";
import {
  cashSessionCloseSchema,
  cashSessionOpenSchema,
  expenseWriteSchema,
} from "@/domain/finance/schemas";

describe("expenseWriteSchema", () => {
  test("parses valid expense", () => {
    const v = expenseWriteSchema.parse({
      category: "rent",
      amount: 99.5,
      note: "April",
    });
    expect(v.amount).toBe(99.5);
  });
});

describe("cashSessionOpenSchema", () => {
  test("allows zero opening", () => {
    expect(
      cashSessionOpenSchema.parse({ openingBalance: 0 }).openingBalance,
    ).toBe(0);
  });
});

describe("cashSessionCloseSchema", () => {
  test("requires session id", () => {
    const r = cashSessionCloseSchema.safeParse({ closingBalance: 100 });
    expect(r.success).toBe(false);
  });
});
