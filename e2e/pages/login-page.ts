import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES } from "../support/routes";

/** Tela de login (TA-001). Seletores conforme design/wireframes/login.html. */
export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly errorAlert: Locator;
  readonly sessionExpired: Locator;
  readonly signupLink: Locator;

  constructor(readonly page: Page) {
    this.email = page.getByLabel("E-mail");
    this.password = page.getByLabel("Senha", { exact: true });
    this.submit = page.getByRole("button", { name: "Entrar" });
    this.errorAlert = page.getByRole("alert");
    this.sessionExpired = page.getByRole("status").filter({ hasText: /sessão expirou/i });
    this.signupLink = page.getByRole("link", { name: "Criar conta" });
  }

  async goto(query = "") {
    await this.page.goto(`${ROUTES.login}${query}`);
    await expect(this.email).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
