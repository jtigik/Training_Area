import { expect, test } from "@playwright/test";

import { MVP_LEVELS, POST_MVP_LEVELS } from "../support/levels";
import { API } from "../support/routes";

// TA-032 — Fundação: o app sobe e o health check responde.
test.describe("Smoke [TA-032]", () => {
  test("home carrega e exibe o título", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Training Area/);
    await expect(page.getByRole("heading", { level: 1, name: "Training Area" })).toBeVisible();
  });

  test("home lista os níveis de conhecimento do MVP", async ({ page }) => {
    // Dashboard foi para a v1.1: o MVP só verifica Fundamental, Profissional e Avançado.
    await page.goto("/");
    const levels = page.getByRole("list", { name: "Níveis de conhecimento" });
    for (const level of MVP_LEVELS) {
      await expect(levels.getByRole("listitem").filter({ hasText: level })).toHaveCount(1);
    }
  });

  test("home NÃO mostra Dashboard (v1.1)", async ({ page }) => {
    // PO: DASHBOARD continua no enum do schema (v1.1), mas não aparece nem é selecionável no MVP.
    // test.fail: o scaffold atual (src/app/page.tsx) ainda lista Dashboard na home.
    // FE1: remover Dashboard da lista; quando corrigir, este teste "passa inesperadamente"
    // e o test.fail deve ser removido.
    test.fail(true, "FE1: home do scaffold ainda lista Dashboard (TA-032 / decisão PO v1.1)");
    await page.goto("/");
    await expect(page.getByRole("list", { name: "Níveis de conhecimento" })).toBeVisible();
    for (const level of POST_MVP_LEVELS) {
      await expect(page.getByText(level, { exact: true })).toHaveCount(0, { timeout: 2_000 });
    }
  });

  test("health check responde ok", async ({ request }) => {
    const response = await request.get(API.health);
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
