import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

vi.mock("@/bridge/users", () => ({
  hasPasswordUsers: vi.fn().mockResolvedValue(true),
  loginSession: vi.fn(),
  verifyCredentials: vi.fn(),
}));

vi.mock("@/bridge/settings", () => ({
  getBusinessSettings: vi
    .fn()
    .mockResolvedValue({ storeName: "Test Co", tradeName: "Test Co" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  it("renders email and password fields", () => {
    render(
      <I18nProvider>
        <LoginPage />
      </I18nProvider>
    );
    expect(screen.getByLabelText("ایمیل")).toBeTruthy();
    expect(screen.getByLabelText("رمز عبور")).toBeTruthy();
  });
});
