import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import DashboardPage from "./dashboard/page";

test("Dashboard page", async () => {
  render(<DashboardPage />);
  expect(await screen.findByRole("main")).toBeTruthy();
  expect(
    screen.getByRole("heading", { level: 1, name: /dashboard/i }),
  ).toBeTruthy();
});
