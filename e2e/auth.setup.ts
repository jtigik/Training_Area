/**
 * Gera o storage state (cookies de sessão) de cada sessão em e2e/.auth/<chave>.json,
 * fazendo login uma única vez com o login por e-mail+senha de TESTE (desligado por padrão
 * no app; a suíte o liga no webServer — ver support/env.ts). Login real é Google/Microsoft
 * e é coberto em specs/auth.spec.ts com o provedor OAuth falso.
 */
import { expect, test as setup } from "@playwright/test";

import { LoginPage } from "./pages/login-page";
import { PASSWORD_LOGIN_ENABLED } from "./support/env";
import { E2E_PASSWORD, SESSION_USERS, authFile, type SessionKey } from "./support/users";

for (const [key, user] of Object.entries(SESSION_USERS) as [
  SessionKey,
  (typeof SESSION_USERS)[SessionKey],
][]) {
  setup(`autentica ${key}`, async ({ page }) => {
    setup.skip(!PASSWORD_LOGIN_ENABLED, "E2E_PASSWORD_LOGIN=0: sem login por senha de teste");
    // Depende de: AUTH_EMAIL_PASSWORD_ENABLED (Backend 1) + conta "credential" do seed (hashPassword do better-auth)
    // e, para super admin / inst-b, do schema multi-tenant (feat/auth-modelo).
    setup.fixme(true, "TA-001: login de teste e hash de senha ainda não existem");

    const login = new LoginPage(page);
    await login.goto();
    await login.loginWithPassword(user.email, E2E_PASSWORD);
    await expect(page).toHaveURL(new RegExp(`${user.home}$`));
    await page.context().storageState({ path: authFile(key) });
  });
}
