/**
 * E1 — Autenticação (TA-001, TA-005) e cookies de sessão (TA-033).
 * Status: fixme até TA-001/TA-005 entrarem (o scaffold não tem /login nem sessão).
 */
import { asAnonymous, asRole, expect, test } from "../fixtures";
import { ROUTES } from "../support/routes";
import { E2E_PASSWORD, USERS, uniqueEmail } from "../support/users";

test.describe("Login por papel [TA-001]", () => {
  asAnonymous();

  for (const user of Object.values(USERS)) {
    test.fixme(`[TA-001 AC2] ${user.key} entra e vai para ${user.home}`, async ({
      page,
      loginPage,
    }) => {
      await loginPage.goto();
      await expect(loginPage.email).toBeFocused();
      await loginPage.login(user.email, E2E_PASSWORD);
      await expect(page).toHaveURL(new RegExp(`${user.home}$`));
    });
  }

  test.fixme("[TA-001 AC3] senha errada mostra erro genérico", async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(USERS.aluno.email, "senha-errada-123");
    await expect(loginPage.errorAlert).toContainText("E-mail ou senha incorretos");
    await expect(page).toHaveURL(new RegExp(`${ROUTES.login}`));
  });

  test.fixme("[TA-001 AC3] e-mail inexistente mostra exatamente o mesmo erro (sem enumeração)", async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.login(USERS.aluno.email, "senha-errada-123");
    const knownEmailMsg = await loginPage.errorAlert.innerText();

    await loginPage.goto();
    await loginPage.login(uniqueEmail("inexistente"), "senha-errada-123");
    await expect(loginPage.errorAlert).toHaveText(knownEmailMsg);
  });

  test.fixme("[TA-001] campos obrigatórios vazios não enviam e mostram validação", async ({
    page,
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.submit.click();
    await expect(page).toHaveURL(new RegExp(ROUTES.login));
    await expect(page.getByText("Informe sua senha.")).toBeVisible();
  });

  test.fixme("[TA-001] respeita ?voltar= quando o papel tem acesso ao destino", async ({
    page,
    loginPage,
  }) => {
    await loginPage.goto(`?voltar=${encodeURIComponent(ROUTES.admin.settings)}`);
    await loginPage.login(USERS.admin.email, E2E_PASSWORD);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.admin.settings}$`));
  });

  test.fixme("[TA-001] ?voltar= para rota de outro papel cai no painel do próprio papel", async ({
    page,
    loginPage,
  }) => {
    await loginPage.goto(`?voltar=${encodeURIComponent(ROUTES.admin.users)}`);
    await loginPage.login(USERS.aluno.email, E2E_PASSWORD);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.student.trail}$`));
  });

  test.fixme("[TA-001 AC4] sessão expirada volta ao login com aviso", async ({
    page,
    context,
    loginPage,
  }) => {
    // Simula expiração apagando os cookies de uma sessão válida.
    await loginPage.goto();
    await loginPage.login(USERS.aluno.email, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/aluno$/);
    await context.clearCookies();
    await page.goto(ROUTES.student.trail);
    await expect(page).toHaveURL(new RegExp(ROUTES.login));
    // Aviso de sessão expirada (?motivo=sessao-expirada) quando o servidor detectar o token vencido.
  });
});

test.describe("Cadastro [TA-001 AC1, TA-007 AC3, TA-008 AC2]", () => {
  asAnonymous();

  test.fixme("[TA-001 AC1] com cadastro aberto, visitante cria conta e já entra autenticado", async ({
    page,
  }) => {
    await page.goto(ROUTES.signup);
    await page.getByLabel("Nome").fill("e2e Visitante");
    await page.getByLabel("E-mail").fill(uniqueEmail("cadastro"));
    await page.getByLabel("Senha", { exact: true }).fill(E2E_PASSWORD);
    await page.getByLabel("Confirmar senha").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /Criar conta/ }).click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.student.trail}$`));
  });

  test.fixme("[TA-007 AC3] com cadastro fechado, o link some e a rota é bloqueada", async ({
    page,
    loginPage,
  }) => {
    // Pré-condição: parâmetro "cadastro aberto" desligado (padrão esperado da instância).
    await loginPage.goto();
    await expect(loginPage.signupLink).toHaveCount(0);
    const response = await page.goto(ROUTES.signup);
    expect([403, 404]).toContain(response?.status());
  });
});

test.describe("Logout [TA-005]", () => {
  asRole("aluno");

  test.fixme("[TA-005 AC1+AC2] sair invalida a sessão e a sessão antiga é recusada", async ({
    page,
    shell,
    context,
  }) => {
    await page.goto(ROUTES.student.trail);
    const cookiesBefore = await context.cookies();
    await shell.logout();
    await expect(page).toHaveURL(new RegExp(ROUTES.login));

    // Reaproveita o cookie antigo em um contexto novo: deve ser recusado no servidor.
    const replay = await page
      .context()
      .browser()!
      .newContext({ storageState: { cookies: cookiesBefore, origins: [] } });
    const replayPage = await replay.newPage();
    await replayPage.goto(ROUTES.student.trail);
    await expect(replayPage).toHaveURL(new RegExp(ROUTES.login));
    await replay.close();
  });
});

test.describe("Cookies de sessão [TA-033 AC3]", () => {
  asRole("aluno");

  test.fixme("cookie de sessão é httpOnly e SameSite Lax/Strict", async ({ page, context }) => {
    await page.goto(ROUTES.student.trail);
    const session = (await context.cookies()).filter((c) => /session|auth|token/i.test(c.name));
    expect(session.length).toBeGreaterThan(0);
    for (const cookie of session) {
      expect(cookie.httpOnly).toBe(true);
      expect(["Lax", "Strict"]).toContain(cookie.sameSite);
    }
  });
});
