import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import DashboardPage from "./dashboard/page";

const DASHBOARD_HEADING = /داشبورد/i;

test("Dashboard page", async () => {
  render(
    <I18nProvider>
      <DashboardPage />
    </I18nProvider>
  );
  expect(await screen.findByRole("main")).toBeTruthy();
  expect(
    screen.getByRole("heading", { level: 1, name: DASHBOARD_HEADING })
  ).toBeTruthy();
});
