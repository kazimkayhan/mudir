import { describe, expect, test } from "vitest";
import { resolveAuthRedirect } from "@/domain/auth/routing";

describe("resolveAuthRedirect", () => {
  test("requires activation without license", () => {
    expect(
      resolveAuthRedirect({
        authed: false,
        hasUsers: false,
        licenseOk: false,
        onboardingCompleted: false,
        pathname: "/dashboard",
        welcomeDone: false,
      })
    ).toBe("/activate");
  });

  test("allows activate page without license", () => {
    expect(
      resolveAuthRedirect({
        authed: false,
        hasUsers: false,
        licenseOk: false,
        onboardingCompleted: false,
        pathname: "/activate",
        welcomeDone: false,
      })
    ).toBeNull();
  });

  test("sends licensed user to welcome first", () => {
    expect(
      resolveAuthRedirect({
        authed: false,
        hasUsers: false,
        licenseOk: true,
        onboardingCompleted: false,
        pathname: "/dashboard",
        welcomeDone: false,
      })
    ).toBe("/welcome");
  });

  test("sends authed user to dashboard after setup", () => {
    expect(
      resolveAuthRedirect({
        authed: true,
        hasUsers: true,
        licenseOk: true,
        onboardingCompleted: true,
        pathname: "/login",
        welcomeDone: true,
      })
    ).toBe("/dashboard");
  });
});
