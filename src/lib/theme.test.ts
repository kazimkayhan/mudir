import { describe, expect, test } from "vitest";
import { resolveTheme } from "@/lib/theme";

describe("resolveTheme", () => {
  test("returns light and dark directly", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });
});
