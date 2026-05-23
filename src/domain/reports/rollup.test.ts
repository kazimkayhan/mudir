import { describe, expect, test } from "vitest";
import {
  computePlLite,
  rollupSalesByChannel,
  rollupSalesByDay,
  salesMapToChartSeries,
} from "@/domain/reports/rollup";

describe("rollupSalesByDay", () => {
  test("sums by day and skips returned sales", () => {
    const map = rollupSalesByDay([
      {
        created_at: "2026-04-01T10:00:00.000Z",
        returned_at: null,
        total_amount: 100,
      },
      {
        created_at: "2026-04-01T15:00:00.000Z",
        returned_at: null,
        total_amount: 50,
      },
      {
        created_at: "2026-04-02T12:00:00.000Z",
        returned_at: "2026-04-03T00:00:00.000Z",
        total_amount: 200,
      },
    ]);
    expect(map.get("2026-04-01")).toBe(150);
    expect(map.get("2026-04-02")).toBeUndefined();
  });
});

describe("salesMapToChartSeries", () => {
  test("fills trailing range with zeros", () => {
    const map = new Map([["2026-04-05", 10]]);
    const end = new Date("2026-04-06T12:00:00.000Z");
    const s = salesMapToChartSeries(map, 3, end);
    expect(s).toHaveLength(3);
    expect(s[0]?.day).toBe("2026-04-04");
    expect(s[0]?.total).toBe(0);
    expect(s[2]?.day).toBe("2026-04-06");
    expect(s[2]?.total).toBe(0);
    expect(s[1]?.total).toBe(10);
  });
});

describe("rollupSalesByChannel", () => {
  test("splits in-store vs online and subtracts returns", () => {
    const totals = rollupSalesByChannel([
      { channel: "in_store", returned_at: null, total_amount: 100 },
      { channel: "online", returned_at: null, total_amount: 50 },
      { channel: "in_store", returned_at: "2026-04-02", total_amount: 20 },
    ]);
    expect(totals.inStore).toBe(100);
    expect(totals.online).toBe(50);
    expect(totals.returns).toBe(20);
    expect(totals.net).toBe(130);
  });
});

describe("computePlLite", () => {
  test("computes net profit", () => {
    expect(computePlLite(1000, 400, 200)).toEqual({
      cogs: 400,
      expenses: 200,
      net: 400,
      revenue: 1000,
    });
  });
});
