/**
 * E1 — Autenticação (TA-001, TA-005) e cookies de sessão (TA-033).
 *
 * Escopo do PO (21/11/2026): NÃO há auto-cadastro. Login de produção só com Google ou
 * Microsoft (OAuth). E-mail+senha existe só como opção de dev/teste, desligada por padrão.
 * O OAuth é testado contra o provedor falso de support/mock-oauth.ts (iniciado no
 * global-setup); o app precisa aceitar issuer configurável (ver e2e/README.md).
 * Status: fixme até o login (Backend 1) existir.
 */
import { asAnonymous, asRole, expect, test } from "../fixtures";
import type { OAuthProvider } from "../pages/login-page";
import { PASSWORD_LOGIN_ENABLED } from "../support/env";
import { ROUTES } from "../support/routes";
import {
  E2E_PASSWORD,
  SESSION_USERS,
  UNPROVISIONED_EMAIL,
  USERS,
  uniqueEmail,
} from "../support/users";

const PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "microsoft", label: "Microsoft" },
];

test.describe("Login com Google/Microsoft (OAuth mockado) [TA-001]", () => {
  asAnonymous();

  for (const provider of PROVIDERS) {
    test.fixme(`[TA-001 AC2] ${provider.label}: aluno provisionado entra e vai para /aluno`, async ({
      page,
      loginPage,
    }) => {
      await loginPage.goto();
      await loginPage.loginWithOAuth(provider.id, USERS.aluno.email);
      await expect(page).toHaveURL(new RegExp(`${USERS.aluno.home}$`));
    });

    test.fixme(`[TA-001] ${provider.label}: consentimento negado volta ao login com aviso, sem sessão`, async ({
      page,
      context,
      loginPage,
    }) => {
      await loginPage.goto();
      await loginPage.loginWithOAuth(provider.id, USERS.aluno.email, { deny: true });
      await expect(page).toHaveURL((url) => url.pathname === ROUTES.login);
      await expect(loginPage.errorAlert).toContainText(/cancelad|negad|não autoriz/i);
      const session = (await context.cookies()).filter(
        (c) => /session|auth/i.test(c.name) && c.value,
      );
      expect(session.filter((c) => !/csrf|state|callback|pkce|nonce/i.test(c.name))).toEqual([]);
    });

    test.fixme(`[TA-001 AC3] ${provider.label}: conta não provisionada é recusada e nada é criado`, async ({
      page,
      loginPage,
    }) => {
      // Sem auto-cadastro: e-mail válido no provedor, mas sem usuário na instituição.
      await loginPage.goto();
      await loginPage.loginWithOAuth(provider.id, UNPROVISIONED_EMAIL);
      await expect(page).toHaveURL((url) => url.pathname === ROUTES.login);
      await expect(loginPage.errorAlert).toContainText(
        /não (está )?(cadastrad|provisionad|liberad)|administrador/i,
      );
      // Tentar de novo dá o mesmo resultado (a 1ª tentativa não criou conta).
      await loginPage.loginWithOAuth(provider.id, UNPROVISIONED_EMAIL);
      await expect(page).toHaveURL((url) => url.pathname === ROUTES.login);
    });
  }

  test.fixme("[TA-001] não existe auto-cadastro: sem link 'Criar conta' e /cadastro → 404", async ({
    page,
    loginPage,
  }) => {
    await loginPage.goto();
    await expect(page.getByRole("link", { name: /Criar conta|Cadastr/ })).toHaveCount(0);
    const res = await page.goto("/cadastro");
    expect(res?.status()).toBe(404);
  });
});

test.describe("Login por e-mail e senha (somente dev/teste) [TA-001]", () => {
  asAnonymous();

  test.describe("flag ligada (padrão da suíte)", () => {
    test.skip(!PASSWORD_LOGIN_ENABLED, "rodando com E2E_PASSWORD_LOGIN=0");

    for (const [key, user] of Object.entries(SESSION_USERS)) {
      test.fixme(`[TA-001 AC2] ${key} entra e vai para ${user.home}`, async ({
        page,
        loginPage,
      }) => {
        await loginPage.goto();
        await loginPage.loginWithPassword(user.email, E2E_PASSWORD);
        await expect(page).toHaveURL(new RegExp(`${user.home}$`));
      });
    }

    test.fixme("[TA-001 AC3] senha errada mostra erro genérico", async ({ page, loginPage }) => {
      await loginPage.goto();
      await loginPage.loginWithPassword(USERS.aluno.email, "senha-errada-123");
      await expect(loginPage.errorAlert).toContainText("E-mail ou senha incorretos");
      await expect(page).toHaveURL(new RegExp(`${ROUTES.login}`));
    });

    test.fixme("[TA-001 AC3] e-mail inexistente mostra exatamente o mesmo erro (sem enumeração)", async ({
      loginPage,
    }) => {
      await loginPage.goto();
      await loginPage.loginWithPassword(USERS.aluno.email, "senha-errada-123");
      const knownEmailMsg = await loginPage.errorAlert.innerText();

      await loginPage.goto();
      await loginPage.loginWithPassword(uniqueEmail("inexistente"), "senha-errada-123");
      await expect(loginPage.errorAlert).toHaveText(knownEmailMsg);
    });

    test.fixme("[TA-001] respeita ?voltar= quando o papel tem acesso ao destino", async ({
      page,
      loginPage,
    }) => {
      await loginPage.goto(`?voltar=${encodeURIComponent(ROUTES.admin.settings)}`);
      await loginPage.loginWithPassword(USERS.admin.email, E2E_PASSWORD);
      await expect(page).toHaveURL(new RegExp(`${ROUTES.admin.settings}$`));
    });

    test.fixme("[TA-001] ?voltar= para rota de outro papel cai no painel do próprio papel", async ({
      page,
      loginPage,
    }) => {
      await loginPage.goto(`?voltar=${encodeURIComponent(ROUTES.admin.users)}`);
      await loginPage.loginWithPassword(USERS.aluno.email, E2E_PASSWORD);
      await expect(page).toHaveURL(new RegExp(`${ROUTES.student.trail}$`));
    });

    test.fixme("[TA-001 AC4] sessão expirada volta ao login", async ({
      page,
      context,
      loginPage,
    }) => {
      await loginPage.goto();
      await loginPage.loginWithPassword(USERS.aluno.email, E2E_PASSWORD);
      await expect(page).toHaveURL(/\/aluno$/);
      await context.clearCookies();
      await page.goto(ROUTES.student.trail);
      await expect(page).toHaveURL(new RegExp(ROUTES.login));
    });
  });

  test.describe("flag desligada (padrão de produção)", () => {
    // Rodar com: E2E_PASSWORD_LOGIN=0 E2E_PORT=3101 npx playwright test -g "flag desligada"
    test.skip(PASSWORD_LOGIN_ENABLED, "só roda com E2E_PASSWORD_LOGIN=0 (app sem a flag de teste)");

    test.fixme("[TA-001] sem a flag, a tela não oferece senha e o endpoint de senha recusa", async ({
      page,
      loginPage,
    }) => {
      await loginPage.goto();
      await expect(loginPage.google).toBeVisible();
      await expect(loginPage.microsoft).toBeVisible();
      await expect(loginPage.password).toHaveCount(0);
      // Contrato a confirmar com o Backend 1 (ex.: Auth.js credentials callback).
      const res = await page.request.post("/api/auth/callback/credentials", {
        form: { email: USERS.aluno.email, password: E2E_PASSWORD },
        maxRedirects: 0,
      });
      expect([400, 401, 403, 404]).toContain(res.status());
    });
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
