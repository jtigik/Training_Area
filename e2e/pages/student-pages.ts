import { expect, type Locator, type Page } from "@playwright/test";

import { ROUTES } from "../support/routes";

/** "Minha trilha" do aluno (TA-020, TA-024) — design/wireframes/aluno-trilha.html. */
export class StudentTrailPage {
  readonly levels: Locator;
  readonly overallProgress: Locator;

  constructor(readonly page: Page) {
    this.levels = page.getByRole("list", { name: "Níveis da trilha" });
    this.overallProgress = page.getByRole("progressbar", { name: "Progresso geral da trilha" });
  }

  async goto() {
    await this.page.goto(ROUTES.student.trail);
  }

  level(name: string) {
    return this.page.getByRole("article", { name });
  }

  levelProgress(name: string) {
    return this.page.getByRole("progressbar", { name: `Progresso do nível ${name}` });
  }

  /** Conceito do nível (texto ND/ED/D/PD). */
  conceptBadge(level: string) {
    return this.level(level).getByTestId("concept-badge");
  }

  /** Botão de refazer o nível (só para ND e ED). */
  redoButton(level: string) {
    return this.level(level).getByTestId("redo-button");
  }

  /** Itens de exercício de um nível. Requer data-testid="exercise-item" (ver e2e/README.md). */
  exerciseItems(level: string) {
    return this.level(level).getByTestId("exercise-item");
  }
}

/** Tela de exercício com a grade (TA-021, TA-022) — design/wireframes/aluno-exercicio.html. */
export class ExercisePage {
  readonly grid: Locator;
  readonly formulaBar: Locator;
  readonly calculate: Locator;
  readonly submit: Locator;
  readonly reset: Locator;
  readonly feedback: Locator;
  readonly hint: Locator;

  constructor(readonly page: Page) {
    this.grid = page.getByRole("grid", { name: "Planilha do exercício" });
    this.formulaBar = page.getByLabel(/Fórmula ou valor da célula/);
    this.calculate = page.getByRole("button", { name: /Calcular/ });
    this.submit = page.getByRole("button", { name: "Enviar resposta" });
    this.reset = page.getByRole("button", { name: "Restaurar planilha" });
    this.feedback = page.getByRole("status").filter({ has: page.getByRole("heading") });
    this.hint = page.getByTestId("exercise-hint");
  }

  /** Célula da grade. Requer data-testid="cell-<REF>" (ex.: cell-G2). */
  cell(ref: string) {
    return this.page.getByTestId(`cell-${ref.toUpperCase()}`);
  }

  async selectCell(ref: string) {
    await this.cell(ref).click();
    await expect(this.formulaBar).toHaveAccessibleName(new RegExp(`célula ${ref}`, "i"));
  }

  /** Digita na barra de fórmulas e confirma (Enter = Calcular, como no wireframe). */
  async enter(ref: string, input: string) {
    await this.selectCell(ref);
    await this.formulaBar.fill(input);
    await this.formulaBar.press("Enter");
  }

  async expectCorrect() {
    await expect(this.feedback.getByRole("heading")).toHaveText(/^\W*Correto/);
  }

  async expectIncorrect() {
    await expect(this.feedback.getByRole("heading")).toHaveText(/^\W*Incorreto/);
  }
}

/** Página de conclusão de nível + feedback (TA-025, TA-026) — aluno-feedback-nivel.html. */
export class LevelFeedbackPage {
  readonly title: Locator;
  readonly message: Locator;
  readonly summary: Locator;

  constructor(readonly page: Page) {
    this.title = page.getByRole("heading", { level: 1, name: /concluído/ });
    this.message = page.getByRole("region", { name: "Seu feedback" });
    this.summary = page.getByRole("region", { name: "Resumo dos exercícios" });
  }
}

/** Leitura de conteúdo pelo aluno (TA-011). */
export class StudentContentPage {
  readonly sections: Locator;
  readonly emptyState: Locator;

  constructor(readonly page: Page) {
    this.sections = page.getByTestId("content-section-item");
    this.emptyState = page.getByText(/aguarde.*professor/i);
  }

  async goto() {
    await this.page.goto(ROUTES.student.content);
  }
}
