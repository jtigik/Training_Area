import { expect, test } from "@playwright/test";

import { API } from "../support/routes";

// TA-032 — Fundação: o app sobe e o health check responde.
test.describe("Smoke [TA-032]", () => {
  test("home carrega e exibe o título", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Training Area/);
    await expect(page.getByRole("heading", { level: 1, name: "Training Area" })).toBeVisible();
  });

  test("home lista os quatro níveis de conhecimento", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("list", { name: "Níveis de conhecimento" }).getByRole("listitem"),
    ).toHaveText(["Fundamental", "Profissional", "Avançado", "Dashboard"]);
  });

  test("health check responde ok", async ({ request }) => {
    const response = await request.get(API.health);
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
