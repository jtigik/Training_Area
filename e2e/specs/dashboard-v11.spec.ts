/**
 * Dashboard é v1.1 (PO + BE1, 21/11/2026): DASHBOARD continua no enum do schema, mas NO MVP
 * não aparece em nenhuma tela nem é selecionável, e a API recusa criar/editar conjunto,
 * nível ou exercício com DASHBOARD. A home do scaffold é coberta em smoke.spec.ts (test.fail).
 */
import { asRole, expect, test } from "../fixtures";
import { MVP_LEVELS, POST_MVP_LEVELS } from "../support/levels";
import { API, ROUTES } from "../support/routes";
import { TENANT_RESOURCES } from "../support/users";

const DASHBOARD_ENUM = "DASHBOARD";

/** Nenhum texto/opção "Dashboard" visível na página atual. */
async function expectNoDashboard(page: import("@playwright/test").Page) {
  for (const level of POST_MVP_LEVELS) {
    await expect(page.getByText(level, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("option", { name: level })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: new RegExp(level) })).toHaveCount(0);
  }
}

test.describe("Dashboard fora do MVP — aluno [v1.1]", () => {
  asRole("aluno");

  test.fixme("[TA-020] trilha lista só os níveis do MVP, sem Dashboard", async ({
    page,
    trail,
  }) => {
    await trail.goto();
    for (const level of MVP_LEVELS) await expect(page.getByText(level).first()).toBeVisible();
    await expectNoDashboard(page);
  });

  test.fixme("[TA-012] conteúdo do aluno não mostra nível Dashboard", async ({ page }) => {
    await page.goto(ROUTES.student.content);
    await expectNoDashboard(page);
  });

  test.fixme("[TA-025] /aluno/niveis/dashboard/feedback não existe (404)", async ({ page }) => {
    const res = await page.goto(ROUTES.student.levelFeedback("dashboard"));
    expect(res?.status()).toBe(404);
  });
});

test.describe("Dashboard fora do MVP — professor [v1.1]", () => {
  asRole("professor");

  test.fixme("[TA-014] criação de conjunto não oferece Dashboard nos níveis", async ({
    page,
    teacherSet,
  }) => {
    await teacherSet.gotoNew();
    for (const level of MVP_LEVELS) await expect(teacherSet.levelCheckbox(level)).toBeVisible();
    await expectNoDashboard(page);
  });

  test.fixme("[TA-016] seletor de nível do exercício não oferece Dashboard", async ({
    page,
    exerciseEditor,
  }) => {
    await page.goto(`${ROUTES.teacher.exerciseBank}/novo`);
    await expect(exerciseEditor.level).toBeVisible();
    const options = await exerciseEditor.level.locator("option").allTextContents();
    expect(options.map((o) => o.trim())).not.toContain("Dashboard");
    await expectNoDashboard(page);
  });

  test.fixme("[TA-029] filtro de nível dos resultados não oferece Dashboard", async ({
    page,
    teacherResults,
  }) => {
    await teacherResults.goto();
    const options = await teacherResults.levelFilter.locator("option").allTextContents();
    expect(options.map((o) => o.trim())).not.toContain("Dashboard");
    await expectNoDashboard(page);
  });

  test.fixme("[TA-010] conteúdo/seções do professor não listam Dashboard", async ({
    page,
    teacherSections,
  }) => {
    await teacherSections.goto();
    await expectNoDashboard(page);
  });

  test.fixme("[TA-014] API: criar conjunto com DASHBOARD → 4xx", async ({ request }) => {
    const res = await request.post(API.teacher.sets, {
      data: { name: "e2e dashboard", levels: [DASHBOARD_ENUM], difficulties: ["MUITO_FACIL"] },
    });
    expect([400, 422]).toContain(res.status());
  });

  test.fixme("[TA-014] API: editar conjunto para DASHBOARD → 4xx", async ({ request }) => {
    const res = await request.patch(API.teacher.set(TENANT_RESOURCES.a.set), {
      data: { levels: [DASHBOARD_ENUM] },
    });
    expect([400, 422]).toContain(res.status());
  });

  test.fixme("[TA-016] API: criar exercício com nível DASHBOARD → 4xx", async ({ request }) => {
    const res = await request.post(API.teacher.exercises, {
      data: { title: "e2e dashboard", level: DASHBOARD_ENUM, difficulty: "MUITO_FACIL" },
    });
    expect([400, 422]).toContain(res.status());
  });

  test.fixme("[TA-016] API: editar exercício para DASHBOARD → 4xx", async ({ request }) => {
    const res = await request.patch(API.teacher.exercise(TENANT_RESOURCES.a.exercise), {
      data: { level: DASHBOARD_ENUM },
    });
    expect([400, 422]).toContain(res.status());
  });

  test.fixme("API: criar/editar nível DASHBOARD → 4xx; lista de níveis selecionáveis sem DASHBOARD", async ({
    request,
  }) => {
    expect([400, 403, 422]).toContain(
      (await request.post(API.teacher.levels, { data: { level: DASHBOARD_ENUM } })).status(),
    );
    expect([400, 403, 404, 422]).toContain(
      (await request.patch(API.teacher.level(DASHBOARD_ENUM), { data: { active: true } })).status(),
    );
    const list = await request.get(API.teacher.levels);
    expect(list.ok()).toBeTruthy();
    expect(await list.text()).not.toContain(DASHBOARD_ENUM);
  });
});
