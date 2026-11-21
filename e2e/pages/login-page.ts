import { expect, type Locator, type Page } from "@playwright/test";

import { OAUTH_MOCK_URL } from "../support/env";
import { setNextOAuthLogin } from "../support/mock-oauth";
import { ROUTES } from "../support/routes";

export type OAuthProvider = "google" | "microsoft";

/**
 * Tela de login (TA-001). Login de produção: só Google ou Microsoft.
 * E-mail+senha aparece apenas quando o app sobe com a flag de teste ligada.
 */
export class LoginPage {
  readonly google: Locator;
  readonly microsoft: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly errorAlert: Locator;
  readonly sessionExpired: Locator;

  constructor(readonly page: Page) {
    this.google = page.getByRole("button", { name: /Entrar com Google/ });
    this.microsoft = page.getByRole("button", { name: /Entrar com Microsoft/ });
    this.email = page.getByLabel("E-mail");
    this.password = page.getByLabel("Senha", { exact: true });
    this.submit = page.getByRole("button", { name: "Entrar", exact: true });
    this.errorAlert = page.getByRole("alert");
    this.sessionExpired = page.getByRole("status").filter({ hasText: /sessão expirou/i });
  }

  async goto(query = "") {
    await this.page.goto(`${ROUTES.login}${query}`);
    await expect(this.google).toBeVisible();
  }

  /** Login de teste (flag de dev/teste ligada). */
  async loginWithPassword(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  /**
   * Login via provedor OAuth falso: define a conta (ou negação) do próximo /authorize
   * e clica no botão do provedor. O mock redireciona de volta ao callback do app.
   */
  async loginWithOAuth(provider: OAuthProvider, email: string, opts: { deny?: boolean } = {}) {
    await setNextOAuthLogin(OAUTH_MOCK_URL, provider, { email, deny: opts.deny });
    await (provider === "google" ? this.google : this.microsoft).click();
  }
}
