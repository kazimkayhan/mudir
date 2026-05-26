import { describe, expect, test } from "vitest";
import {
  getCompletedTours,
  isTourCompleted,
  markTourCompleted,
  resetAllTours,
} from "@/lib/onboarding-storage";

describe("onboarding storage", () => {
  test("tracks completed tours", () => {
    localStorage.clear();
    resetAllTours();
    expect(getCompletedTours()).toEqual([]);
    expect(isTourCompleted("dashboard")).toBe(false);
    markTourCompleted("dashboard");
    expect(getCompletedTours()).toEqual(["dashboard"]);
    expect(isTourCompleted("dashboard")).toBe(true);
  });
});
