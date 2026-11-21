import type { Locator, Page } from "@playwright/test";

import { ROUTES } from "../support/routes";

/** Conjunto de exercícios (TA-014, TA-015, TA-019) — professor-conjunto.html. */
export class TeacherSetPage {
  readonly name: Locator;
  readonly save: Locator;
  readonly publish: Locator;
  readonly unpublish: Locator;
  readonly validationErrors: Locator;

  constructor(readonly page: Page) {
    this.name = page.getByLabel("Nome do conjunto");
    this.save = page.getByRole("button", { name: "Salvar", exact: true });
    this.publish = page.getByRole("button", { name: "Publicar conjunto" });
    this.unpublish = page.getByRole("button", { name: "Despublicar conjunto" });
    this.validationErrors = page.getByRole("alert");
  }

  async gotoNew() {
    await this.page.goto(`${ROUTES.teacher.sets}/novo`);
  }

  levelCheckbox(level: string) {
    return this.page.getByRole("checkbox", { name: new RegExp(`Nível: ${level}`) });
  }

  quantity(level: string) {
    return this.page.getByLabel(`Exercícios por aluno — ${level}`);
  }

  difficulty(name: string) {
    return this.page
      .getByRole("group", { name: "Dificuldades" })
      .getByRole("checkbox", { name: new RegExp(name) });
  }
}

/** Novo exercício (TA-016, TA-017, TA-018) — professor-criar-exercicio.html. */
export class TeacherExerciseEditorPage {
  readonly title: Locator;
  readonly level: Locator;
  readonly statement: Locator;
  readonly preview: Locator;
  readonly saveDraft: Locator;
  readonly saveAndPublish: Locator;

  constructor(readonly page: Page) {
    this.title = page.getByLabel(/^Título/);
    this.level = page.getByLabel(/^Nível/);
    this.statement = page.getByLabel("Enunciado");
    this.preview = page.getByRole("button", { name: "Pré-visualizar como aluno" });
    this.saveDraft = page.getByRole("button", { name: "Salvar rascunho" });
    this.saveAndPublish = page.getByRole("button", { name: "Salvar e publicar" });
  }

  difficulty(name: string) {
    return this.page.getByRole("radio", { name: new RegExp(name) });
  }

  /** Célula da grade de autoria (mesmo componente da grade do aluno). */
  cell(ref: string) {
    return this.page.getByTestId(`cell-${ref.toUpperCase()}`);
  }

  /** Marca uma célula como gabarito. Requer data-testid="answer-cell-<REF>". */
  answerCell(ref: string) {
    return this.page.getByTestId(`answer-cell-${ref.toUpperCase()}`);
  }
}

/** Conteúdo do professor (TA-010, TA-012, TA-013). */
export class TeacherSectionsPage {
  readonly newSection: Locator;
  readonly title: Locator;
  readonly body: Locator;
  readonly save: Locator;
  readonly publish: Locator;
  readonly unpublish: Locator;
  readonly items: Locator;

  constructor(readonly page: Page) {
    this.newSection = page.getByRole("button", { name: "Nova seção" });
    this.title = page.getByLabel("Título");
    this.body = page.getByLabel(/Corpo|Conteúdo/);
    this.save = page.getByRole("button", { name: "Salvar" });
    this.publish = page.getByRole("button", { name: "Publicar" });
    this.unpublish = page.getByRole("button", { name: "Despublicar" });
    this.items = page.getByTestId("section-item");
  }

  async goto() {
    await this.page.goto(ROUTES.teacher.sections);
  }
}

/** Painel de resultados (TA-028, TA-029, TA-030). */
export class TeacherResultsPage {
  readonly table: Locator;
  readonly levelFilter: Locator;
  readonly difficultyFilter: Locator;
  readonly emptyState: Locator;

  constructor(readonly page: Page) {
    this.table = page.getByRole("table", { name: /Resultados|Turma/ });
    this.levelFilter = page.getByLabel("Nível");
    this.difficultyFilter = page.getByLabel("Dificuldade");
    this.emptyState = page.getByText(/nenhum resultado/i);
  }

  async goto() {
    await this.page.goto(ROUTES.teacher.results);
  }

  studentRow(name: string) {
    return this.table.getByRole("row", { name: new RegExp(name) });
  }
}
