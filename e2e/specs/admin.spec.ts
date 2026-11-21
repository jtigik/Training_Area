/**
 * E2 — Área administrativa da INSTITUIÇÃO (Admin com tenant): usuários, papéis e parâmetros.
 * "admin" = Admin da e2e-inst-a. Escopo entre instituições: specs/tenant-isolation.spec.ts.
 * Histórias: TA-002, TA-006, TA-007, TA-008.
 */
import { asAnonymous, asRole, expect, test } from "../fixtures";
import { LoginPage } from "../pages/login-page";
import { API } from "../support/routes";
import { E2E_PASSWORD, OTHER_STUDENT, TENANT_USERS, USERS, uniqueEmail } from "../support/users";

// Os testes deste arquivo alteram papéis/status de usuários semeados (último admin por
// instituição): rodam em sequência num só worker para não colidirem entre si.
test.describe.configure({ mode: "default" });

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
    await login.loginWithPassword(OTHER_STUDENT.email, E2E_PASSWORD);
    await expect(login.errorAlert).toBeVisible();

    await adminUsers.toggleActive(OTHER_STUDENT.email).click(); // Reativar
    await expect(adminUsers.row(OTHER_STUDENT.email)).toContainText("Ativo");
    await login.goto();
    await login.loginWithPassword(OTHER_STUDENT.email, E2E_PASSWORD);
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

  test.fixme("[TA-002 AC3] Admin A não pode rebaixar o único Admin da instituição A (ele mesmo)", async ({
    request,
  }) => {
    const res = await request.patch(API.admin.user(TENANT_USERS.a.admin.id), {
      data: { role: "TEACHER" },
    });
    expect(res.status()).toBe(409);
    expect(await res.json()).toMatchObject({ code: "ultimo_admin" });
  });

  test.fixme("[TA-002 AC3] Admin A não pode desativar o único Admin da instituição A", async ({
    request,
  }) => {
    const res = await request.patch(API.admin.user(TENANT_USERS.a.admin.id), {
      data: { active: false },
    });
    expect(res.status()).toBe(409);
  });

  test.fixme("[TA-002 AC3] com dois Admins na inst-a, rebaixar um deles é permitido", async ({
    request,
  }) => {
    // A regra é "último admin DA INSTITUIÇÃO": com um segundo admin na inst-a, rebaixar passa.
    const promote = await request.patch(API.admin.user(TENANT_USERS.a.professor.id), {
      data: { role: "ADMIN" },
    });
    expect(promote.ok()).toBeTruthy();
    const demote = await request.patch(API.admin.user(TENANT_USERS.a.professor.id), {
      data: { role: "TEACHER" },
    });
    expect(demote.ok()).toBeTruthy();
  });
});

test.describe("Último admin por instituição — Super Admin [TA-002 AC3]", () => {
  asRole("superadmin");

  for (const key of ["a", "b"] as const) {
    test.fixme(`[TA-002 AC3] nem o Super Admin rebaixa o único Admin da inst-${key}`, async ({
      request,
    }) => {
      const res = await request.patch(API.admin.user(TENANT_USERS[key].admin.id), {
        data: { role: "TEACHER" },
      });
      expect(res.status()).toBe(409);
      expect(await res.json()).toMatchObject({ code: "ultimo_admin" });
    });
  }
});

test.describe("Parâmetros da instância [TA-008]", () => {
  test.describe("como admin", () => {
    asRole("admin");

    test.fixme("[TA-008 AC1] nome da instituição aparece no cabeçalho", async ({
      page,
      adminSettings,
    }) => {
      const name = `e2e Instância ${Date.now()}`;
      await adminSettings.goto();
      const original = await adminSettings.instanceName.inputValue();
      await adminSettings.instanceName.fill(name);
      await adminSettings.save.click();
      await expect(page.getByRole("banner")).toContainText(name);
      // Multi-tenant: a tela de login é comum a todas as instituições, então o nome da
      // instituição no login fica a confirmar com o PO (não testado aqui).

      await adminSettings.instanceName.fill(original);
      await adminSettings.save.click();
    });
  });

  test.describe("como visitante", () => {
    asAnonymous();
    test.fixme("[TA-008 AC3] API de parâmetros sem login → 401", async ({ request }) => {
      expect((await request.get(API.admin.config)).status()).toBe(401);
    });
  });
});
