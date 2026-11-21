/**
 * E2 — Área administrativa: usuários, papéis e parâmetros.
 * Histórias: TA-002, TA-006, TA-007, TA-008.
 */
import { asAnonymous, asRole, expect, test } from "../fixtures";
import { LoginPage } from "../pages/login-page";
import { API } from "../support/routes";
import { E2E_PASSWORD, OTHER_STUDENT, USERS, uniqueEmail } from "../support/users";

test.describe("Gestão de usuários [TA-006, TA-007]", () => {
  asRole("admin");

  test.fixme("[TA-006 AC1] lista nome, e-mail, papel e status com busca e paginação", async ({
    adminUsers,
  }) => {
    await adminUsers.goto();
    for (const header of ["Nome", "E-mail", "Papel", "Status"]) {
      await expect(adminUsers.table.getByRole("columnheader", { name: header })).toBeVisible();
    }
    await adminUsers.search.fill("e2e.aluno2");
    await expect(adminUsers.row(OTHER_STUDENT.email)).toBeVisible();
    await expect(adminUsers.row(USERS.professor.email)).toHaveCount(0);
    await expect(adminUsers.pagination).toBeVisible();
  });

  test.fixme("[TA-006 AC2+AC3] desativar bloqueia o login; reativar devolve com o mesmo papel", async ({
    browser,
    adminUsers,
  }) => {
    await adminUsers.goto();
    await adminUsers.search.fill(OTHER_STUDENT.email);
    await adminUsers.toggleActive(OTHER_STUDENT.email).click(); // Desativar
    await expect(adminUsers.row(OTHER_STUDENT.email)).toContainText("Inativo");

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const login = new LoginPage(await ctx.newPage());
    await login.goto();
    await login.login(OTHER_STUDENT.email, E2E_PASSWORD);
    await expect(login.errorAlert).toBeVisible();

    await adminUsers.toggleActive(OTHER_STUDENT.email).click(); // Reativar
    await expect(adminUsers.row(OTHER_STUDENT.email)).toContainText("Ativo");
    await login.goto();
    await login.login(OTHER_STUDENT.email, E2E_PASSWORD);
    await expect(login.page).toHaveURL(/\/aluno$/);
    await ctx.close();
  });

  test.fixme("[TA-007 AC1+AC2] cria usuário com papel; e-mail duplicado dá erro e não duplica", async ({
    page,
    adminUsers,
  }) => {
    const email = uniqueEmail("criado");
    await adminUsers.goto();
    for (let i = 0; i < 2; i++) {
      await adminUsers.newUser.click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Nome").fill("e2e Criado");
      await dialog.getByLabel("E-mail").fill(email);
      await dialog.getByLabel("Papel").selectOption({ label: "Professor" });
      await dialog.getByRole("button", { name: /Criar|Convidar/ }).click();
      if (i === 1) await expect(dialog.getByRole("alert")).toContainText(/já (existe|cadastrado)/i);
    }
    await page.keyboard.press("Escape");
    await adminUsers.search.fill(email);
    await expect(adminUsers.row(email)).toHaveCount(1);
  });
});

test.describe("Papéis [TA-002]", () => {
  asRole("admin");

  test.fixme("[TA-002 AC1] alterar papel vale na próxima requisição", async ({ adminUsers }) => {
    await adminUsers.goto();
    await adminUsers.search.fill(OTHER_STUDENT.email);
    await adminUsers.roleSelect(OTHER_STUDENT.email).selectOption({ label: "Professor" });
    await expect(adminUsers.row(OTHER_STUDENT.email)).toContainText("Professor");
    // Restaura para não afetar outros testes.
    await adminUsers.roleSelect(OTHER_STUDENT.email).selectOption({ label: "Aluno" });
  });

  test.fixme("[TA-002 AC3] rebaixar o último administrador é recusado", async ({ request }) => {
    // Pré-condição: banco e2e com um único ADMIN ativo (seed do app + e2e.admin → ajustar).
    const res = await request.patch(API.admin.user(USERS.admin.id), { data: { role: "TEACHER" } });
    expect(res.status()).toBe(409);
    expect(await res.json()).toMatchObject({ code: "ultimo_admin" });
  });
});

test.describe("Parâmetros da instância [TA-008]", () => {
  test.describe("como admin", () => {
    asRole("admin");

    test.fixme("[TA-008 AC1] nome da instância aparece no cabeçalho e no login", async ({
      browser,
      page,
      adminSettings,
    }) => {
      const name = `e2e Instância ${Date.now()}`;
      await adminSettings.goto();
      const original = await adminSettings.instanceName.inputValue();
      await adminSettings.instanceName.fill(name);
      await adminSettings.save.click();
      await expect(page.getByRole("banner")).toContainText(name);

      const anon = await browser.newPage({ storageState: { cookies: [], origins: [] } });
      await anon.goto("/login");
      await expect(anon.getByRole("heading", { level: 1 })).toContainText(name);
      await anon.close();

      await adminSettings.instanceName.fill(original);
      await adminSettings.save.click();
    });

    test.fixme("[TA-008 AC2] política de cadastro controla o botão Criar conta no login", async ({
      browser,
      adminSettings,
    }) => {
      await adminSettings.goto();
      await adminSettings.openSignup.check();
      await adminSettings.save.click();
      const anon = await browser.newPage({ storageState: { cookies: [], origins: [] } });
      await anon.goto("/login");
      await expect(anon.getByRole("link", { name: "Criar conta" })).toBeVisible();
      await adminSettings.openSignup.uncheck();
      await adminSettings.save.click();
      await anon.reload();
      await expect(anon.getByRole("link", { name: "Criar conta" })).toHaveCount(0);
      await anon.close();
    });
  });

  test.describe("como visitante", () => {
    asAnonymous();
    test.fixme("[TA-008 AC3] API de parâmetros sem login → 401", async ({ request }) => {
      expect((await request.get(API.admin.config)).status()).toBe(401);
    });
  });
});
