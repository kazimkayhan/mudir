import { describe, expect, test } from "vitest";
import {
  rollupSalesByDay,
  salesMapToChartSeries,
} from "@/domain/reports/rollup";

describe("rollupSalesByDay", () => {
  test("sums by day and skips returned sales", () => {
    const map = rollupSalesByDay([
      {
        created_at: "2026-04-01T10:00:00.000Z",
        total_amount: 100,
        returned_at: null,
      },
      {
        created_at: "2026-04-01T15:00:00.000Z",
        total_amount: 50,
        returned_at: null,
      },
      {
        created_at: "2026-04-02T12:00:00.000Z",
        total_amount: 200,
        returned_at: "2026-04-03T00:00:00.000Z",
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
