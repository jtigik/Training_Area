import type { Locator, Page } from "@playwright/test";

import { ROUTES } from "../support/routes";

/** Gestão de usuários (TA-002, TA-006, TA-007). */
export class AdminUsersPage {
  readonly table: Locator;
  readonly search: Locator;
  readonly newUser: Locator;
  readonly pagination: Locator;

  constructor(readonly page: Page) {
    this.table = page.getByRole("table", { name: /Usuários/ });
    this.search = page.getByRole("searchbox", { name: /Buscar/ });
    this.newUser = page.getByRole("button", { name: /Novo usuário|Convidar/ });
    this.pagination = page.getByRole("navigation", { name: /Paginação/ });
  }

  async goto() {
    await this.page.goto(ROUTES.admin.users);
  }

  row(email: string) {
    return this.table.getByRole("row").filter({ hasText: email });
  }

  roleSelect(email: string) {
    return this.row(email).getByRole("combobox", { name: /Papel/ });
  }

  toggleActive(email: string) {
    return this.row(email).getByRole("button", { name: /Desativar|Reativar|Ativar/ });
  }
}

/** Parâmetros globais da instância (TA-008). */
export class AdminSettingsPage {
  readonly instanceName: Locator;
  readonly save: Locator;

  constructor(readonly page: Page) {
    this.instanceName = page.getByLabel("Nome da instância");
    this.save = page.getByRole("button", { name: "Salvar" });
  }

  async goto() {
    await this.page.goto(ROUTES.admin.settings);
  }
}

/** Gestão de instituições pelo Super Admin (/superadmin/instituicoes). */
export class SuperAdminInstitutionsPage {
  readonly items: Locator;

  constructor(readonly page: Page) {
    this.items = page.getByTestId("institution-item");
  }

  async goto() {
    await this.page.goto(ROUTES.superAdmin.institutions);
  }

  item(name: string) {
    return this.items.filter({ hasText: name });
  }
}
