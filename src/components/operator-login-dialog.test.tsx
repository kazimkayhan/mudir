import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { OperatorLoginDialog } from "@/components/operator-login-dialog";
import { I18nProvider } from "@/i18n/provider";

vi.mock("@/bridge/users", () => ({
  ensureDefaultOwner: vi.fn().mockResolvedValue(undefined),
  setStoredOperator: vi.fn(),
  verifyPin: vi.fn(),
}));

const LOGIN_BUTTON_NAME = /log in|ورود/i;

describe("OperatorLoginDialog", () => {
  test("renders PIN login", () => {
    render(
      <I18nProvider>
        <OperatorLoginDialog onLoggedIn={() => undefined} open />
      </I18nProvider>
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: LOGIN_BUTTON_NAME })
    ).toBeTruthy();
  });
});
