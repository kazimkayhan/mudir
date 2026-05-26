import { describe, expect, test } from "vitest";
import { isWelcomeCompleted, markWelcomeCompleted } from "@/lib/welcome";

describe("welcome storage", () => {
  test("marks welcome completed", () => {
    localStorage.clear();
    expect(isWelcomeCompleted()).toBe(false);
    markWelcomeCompleted();
    expect(isWelcomeCompleted()).toBe(true);
  });
});
