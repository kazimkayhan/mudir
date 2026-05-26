import { describe, expect, it } from "vitest";
import { computeTourPopoverStyle } from "@/lib/tour-popover-position";

describe("computeTourPopoverStyle", () => {
  it("places popover below short targets when there is room", () => {
    const style = computeTourPopoverStyle({
      height: 48,
      left: 40,
      top: 80,
      width: 200,
    });

    expect(style.top).toBe(140);
    expect(style.left).toBe(40);
  });

  it("places popover beside tall targets", () => {
    Object.defineProperty(document.documentElement, "dir", {
      configurable: true,
      value: "ltr",
    });

    const style = computeTourPopoverStyle({
      height: 700,
      left: 0,
      top: 60,
      width: 240,
    });

    expect(style.left).toBeGreaterThan(240);
    expect(style.top).toBeGreaterThanOrEqual(16);
    expect(style.top).toBeLessThan(200);
  });
});
