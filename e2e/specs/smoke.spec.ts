import { expect, test } from "@playwright/test";

test("home carrega e exibe o título", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Training Area/);
  await expect(page.getByRole("heading", { level: 1, name: "Training Area" })).toBeVisible();
});

test("health check responde ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({ status: "ok" });
});
