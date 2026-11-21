/**
 * E3/E4 — Fluxos do professor: conteúdo, conjunto, exercício, pré-visualização e publicação.
 * Histórias: TA-010, TA-013, TA-014, TA-015, TA-016, TA-017, TA-018, TA-019.
 * Todos os registros usam prefixo "e2e" + timestamp para não colidir com dados reais.
 */
import { EXERCISE } from "../data/formulas";
import { asRole, expect, test } from "../fixtures";
import { ROUTES } from "../support/routes";

/** Conjunto semeado no banco e2e (só nível Fundamental) usado pelos testes de exercício. */
const SEEDED_SET = "e2e-conjunto";

const stamp = () => `e2e ${Date.now()}`;

test.describe("Seções de conteúdo [TA-010, TA-013]", () => {
  asRole("professor");

  test.fixme("[TA-010 AC1+AC3] cria seção em rascunho e publica", async ({
    page,
    teacherSections,
  }) => {
    const title = `${stamp()} seção`;
    await teacherSections.goto();
    await teacherSections.newSection.click();
    await teacherSections.title.fill(title);
    await teacherSections.body.fill("## SOMA\n\nUse `=SOMA(A1:A3)`.");
    await teacherSections.save.click();
    await expect(page.getByText("Rascunho")).toBeVisible();
    await teacherSections.publish.click();
    await expect(page.getByText("Publicada")).toBeVisible();
  });

  test.fixme("[TA-010 AC2] reordenar seções persiste após recarregar", async ({
    page,
    teacherSections,
  }) => {
    await teacherSections.goto();
    const before = await teacherSections.items.allInnerTexts();
    await teacherSections.items.nth(1).getByRole("button", { name: "Mover para cima" }).click();
    await page.reload();
    const after = await teacherSections.items.allInnerTexts();
    expect(after[0]).toBe(before[1]);
  });

  test.fixme("[TA-013 AC1+AC2] despublicar não apaga; arquivada restaurada volta como rascunho", async ({
    page,
    teacherSections,
  }) => {
    await teacherSections.goto();
    const item = teacherSections.items.filter({ hasText: "e2e" }).first();
    await item.click();
    await teacherSections.unpublish.click();
    await expect(page.getByText("Rascunho")).toBeVisible();
    await page.getByRole("button", { name: "Arquivar" }).click();
    await page.getByRole("button", { name: "Restaurar" }).click();
    await expect(page.getByText("Rascunho")).toBeVisible();
  });
});

test.describe("Conjunto de exercícios [TA-014, TA-015, TA-019]", () => {
  asRole("professor");

  test.fixme("[TA-014 AC1 + TA-015 AC1] cria conjunto com níveis, dificuldades e quantidade", async ({
    page,
    teacherSet,
  }) => {
    await teacherSet.gotoNew();
    await teacherSet.name.fill(`${stamp()} conjunto`);
    await teacherSet.levelCheckbox("Fundamental").check();
    await teacherSet.quantity("Fundamental").fill("1");
    await teacherSet.difficulty("Muito fácil").check();
    await teacherSet.save.click();
    await expect(page.getByText("Rascunho")).toBeVisible();
    await page.reload();
    await expect(teacherSet.quantity("Fundamental")).toHaveValue("1");
  });

  test.fixme("[TA-014 AC3] sem nível selecionado não salva", async ({ teacherSet }) => {
    await teacherSet.gotoNew();
    await teacherSet.name.fill(`${stamp()} sem nível`);
    for (const level of ["Fundamental", "Profissional", "Avançado", "Dashboard"]) {
      await teacherSet.levelCheckbox(level).uncheck();
    }
    await teacherSet.save.click();
    await expect(teacherSet.validationErrors).toContainText(/nível/i);
  });

  for (const qty of ["0", "-1"]) {
    test.fixme(`[TA-015 AC2] quantidade ${qty} é recusada`, async ({ teacherSet }) => {
      await teacherSet.gotoNew();
      await teacherSet.name.fill(`${stamp()} qtd`);
      await teacherSet.levelCheckbox("Fundamental").check();
      await teacherSet.quantity("Fundamental").fill(qty);
      await teacherSet.save.click();
      await expect(teacherSet.validationErrors).toContainText(/quantidade/i);
    });
  }

  test.fixme("[TA-015 AC3] quantidade maior que o pool publicado bloqueia a publicação", async ({
    teacherSet,
  }) => {
    await teacherSet.gotoNew();
    await teacherSet.name.fill(`${stamp()} pool curto`);
    await teacherSet.levelCheckbox("Fundamental").check();
    await teacherSet.quantity("Fundamental").fill("999");
    await teacherSet.save.click();
    await expect(teacherSet.publish).toBeDisabled();
  });

  test.fixme("[TA-019 AC1+AC2] publicar libera para alunos; despublicar mantém progresso", async ({
    page,
    teacherSet,
  }) => {
    // Pré-condição: conjunto semeado "e2e conjunto publicável" com exercícios suficientes.
    await page.goto(ROUTES.teacher.sets);
    await page.getByRole("link", { name: /e2e conjunto publicável/ }).click();
    await teacherSet.publish.click();
    await expect(page.getByText("Publicado")).toBeVisible();
    await teacherSet.unpublish.click();
    await expect(page.getByText(/Rascunho|Despublicado/)).toBeVisible();
  });
});

test.describe("Exercício [TA-016, TA-017, TA-018]", () => {
  asRole("professor");
  test.beforeEach(async ({ page }) => {
    await page.goto(`${ROUTES.teacher.sets}/${SEEDED_SET}/exercicios/novo`);
  });

  test.fixme("[TA-016 AC1+AC3] salva exercício com grade e gabarito e reabre igual", async ({
    page,
    exerciseEditor,
  }) => {
    const title = `${stamp()} exercício`;
    await exerciseEditor.title.fill(title);
    await exerciseEditor.level.selectOption(EXERCISE.level);
    await exerciseEditor.difficulty(EXERCISE.difficulty).check();
    await exerciseEditor.statement.fill("Some A1:A3 em A4.");
    for (const [ref, value] of Object.entries(EXERCISE.grid)) {
      await exerciseEditor.cell(ref).fill(String(value));
    }
    await exerciseEditor.answerCell(EXERCISE.answerCell).fill(EXERCISE.answerFormula);
    await exerciseEditor.saveDraft.click();
    await page.reload();
    await expect(exerciseEditor.title).toHaveValue(title);
    await expect(exerciseEditor.answerCell(EXERCISE.answerCell)).toHaveValue(
      EXERCISE.answerFormula,
    );
  });

  test.fixme("[TA-016 AC2] gabarito vazio impede salvar", async ({ page, exerciseEditor }) => {
    await exerciseEditor.title.fill(`${stamp()} sem gabarito`);
    await exerciseEditor.saveDraft.click();
    await expect(page.getByRole("alert")).toContainText(/gabarito/i);
  });

  test.fixme("[TA-017 AC2] nível fora do conjunto é recusado", async ({ page, exerciseEditor }) => {
    await exerciseEditor.title.fill(`${stamp()} nível errado`);
    await exerciseEditor.level.selectOption("Dashboard"); // conjunto só com Fundamental
    await exerciseEditor.saveDraft.click();
    await expect(page.getByRole("alert")).toContainText(/nível/i);
  });

  test.fixme("[TA-018 AC1+AC2+AC3] pré-visualização igual à do aluno, sem gabarito e sem gravar tentativa", async ({
    page,
    exerciseEditor,
  }) => {
    const popupPromise = page.waitForEvent("popup").catch(() => page);
    await exerciseEditor.preview.click();
    const preview = await popupPromise;
    await expect(preview.getByRole("grid", { name: "Planilha do exercício" })).toBeVisible();
    await expect(preview.getByText(EXERCISE.answerFormula)).toHaveCount(0);
    await preview.getByTestId(`cell-${EXERCISE.answerCell}`).click();
    await preview.getByLabel(/Fórmula ou valor da célula/).fill("=SUM(A1:A3)");
    await preview.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(preview.getByRole("status").getByRole("heading")).toHaveText(/Correto/);
  });
});
