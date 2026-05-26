import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/bridge/settings";
import { parseNumberInput } from "@/lib/number-input";
import {
  readStoredBusinessSettings,
  writeStoredBusinessSettings,
} from "@/lib/settings-storage";

describe("parseNumberInput", () => {
  it("returns 0 for empty input", () => {
    expect(parseNumberInput("")).toBe(0);
    expect(parseNumberInput("   ")).toBe(0);
  });

  it("returns parsed number or fallback", () => {
    expect(parseNumberInput("12.5")).toBe(12.5);
    expect(parseNumberInput("abc", 0)).toBe(0);
  });
});

describe("settings storage", () => {
  it("round-trips business settings", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      onboardingCompleted: true,
      storeName: "Test",
      updatedAt: new Date().toISOString(),
      usdToAfnRate: 0,
    };
    writeStoredBusinessSettings(settings);
    expect(readStoredBusinessSettings()?.storeName).toBe("Test");
    localStorage.removeItem("mudir-business-settings");
  });
});
