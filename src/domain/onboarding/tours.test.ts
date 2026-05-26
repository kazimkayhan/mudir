import { describe, expect, test } from "vitest";
import { getTour, tourIdForPath } from "@/domain/onboarding/tours";

describe("tour definitions", () => {
  test("maps paths to tour ids", () => {
    expect(tourIdForPath("/dashboard")).toBe("dashboard");
    expect(tourIdForPath("/products")).toBe("products");
    expect(tourIdForPath("/pos")).toBe("pos");
    expect(tourIdForPath("/purchases")).toBe("purchases");
    expect(tourIdForPath("/reports")).toBeNull();
  });

  test("includes dashboard tour steps", () => {
    expect(getTour("dashboard")?.steps.length).toBeGreaterThan(0);
  });
});
