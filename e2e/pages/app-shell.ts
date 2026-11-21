import type { Locator, Page } from "@playwright/test";

/** Cabeçalho comum das áreas autenticadas (wireframes: nav "Principal" + menu da conta). */
export class AppShell {
  readonly mainNav: Locator;
  readonly accountMenu: Locator;

  constructor(readonly page: Page) {
    this.mainNav = page.getByRole("navigation", { name: "Principal" });
    this.accountMenu = page.getByRole("button", { name: /Menu da conta/ });
  }

  navLink(name: string | RegExp) {
    return this.mainNav.getByRole("link", { name });
  }

  async logout() {
    await this.accountMenu.click();
    await this.page.getByRole("menuitem", { name: "Sair" }).click();
  }
}
