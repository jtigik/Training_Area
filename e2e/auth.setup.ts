/**
 * Gera o storage state (cookies de sessão) de cada papel em e2e/.auth/<papel>.json,
 * fazendo login pela UI uma única vez. Os specs usam `asRole("aluno")` etc.
 */
import { expect, test as setup } from "@playwright/test";

import { LoginPage } from "./pages/login-page";
import { E2E_PASSWORD, USERS, authFile } from "./support/users";

for (const user of Object.values(USERS)) {
  setup(`autentica ${user.key}`, async ({ page }) => {
    // TA-001 (login) ainda não implementado no scaffold: sem /login e sem hash de senha
    // no seed (ver TODO em global-setup.ts). Remover o fixme quando TA-001 entrar.
    setup.fixme(true, "TA-001: /login e hash de senha ainda não existem");

    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.email, E2E_PASSWORD);
    await expect(page).toHaveURL(new RegExp(`${user.home}$`));
    await page.context().storageState({ path: authFile(user.key) });
  });
}
