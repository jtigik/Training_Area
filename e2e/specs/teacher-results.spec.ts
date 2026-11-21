/**
 * E6/E7 — Faixas de feedback (TA-027) e resultados do professor (TA-028, TA-029, TA-030).
 */
import { EXERCISE } from "../data/formulas";
import { asRole, expect, test } from "../fixtures";
import { ROUTES } from "../support/routes";
import { OTHER_STUDENT, USERS } from "../support/users";

test.describe("Resultados da turma [TA-028, TA-029, TA-030]", () => {
  asRole("professor");

  test.fixme("[TA-028 AC1+AC2] lista alunos com status por nível; sem tentativas = Não iniciado", async ({
    teacherResults,
  }) => {
    await teacherResults.goto();
    await expect(teacherResults.studentRow(USERS.aluno.name)).toBeVisible();
    await expect(teacherResults.studentRow(OTHER_STUDENT.name)).toContainText("Não iniciado");
  });

  test.fixme("[TA-029 AC1] detalhe mostra exercício, data/hora em SP, fórmula, resultado e nº de tentativas", async ({
    page,
    teacherResults,
  }) => {
    await teacherResults.goto();
    await teacherResults.studentRow(USERS.aluno.name).getByRole("link").first().click();
    const attempts = page.getByRole("table", { name: /Tentativas/ });
    await expect(attempts).toContainText(EXERCISE.title);
    await expect(attempts).toContainText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    await expect(attempts).toContainText(EXERCISE.answerFormula);
    await expect(attempts).toContainText(/Correto|Incorreto/);
  });

  test.fixme("[TA-029 AC3] testes locais (sem enviar) não aparecem no detalhe", async ({
    page,
    teacherResults,
  }) => {
    await teacherResults.goto();
    await teacherResults.studentRow(USERS.aluno.name).getByRole("link").first().click();
    // student-practice.spec.ts testa "=SOMA(A1:A2)" sem enviar num cenário dedicado.
    await expect(page.getByRole("table", { name: /Tentativas/ })).toBeVisible();
  });

  test.fixme("[TA-030 AC1] filtro por nível e dificuldade reflete na lista e nos totais", async ({
    page,
    teacherResults,
  }) => {
    await teacherResults.goto();
    await teacherResults.levelFilter.selectOption("Fundamental");
    await teacherResults.difficultyFilter.selectOption("Muito fácil");
    await expect(page).toHaveURL(/level=|nivel=/);
    await expect(teacherResults.table.getByRole("row")).not.toHaveCount(0);
  });

  test.fixme("[TA-030 AC2] período sem dados mostra lista vazia com mensagem clara", async ({
    page,
    teacherResults,
  }) => {
    await teacherResults.goto();
    await page.getByLabel("De").fill("2000-01-01");
    await page.getByLabel("Até").fill("2000-01-02");
    await expect(teacherResults.emptyState).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});

test.describe("Faixas de feedback [TA-027]", () => {
  asRole("professor");

  test.fixme("[TA-027 AC1] cadastra faixas 0–50 / 51–80 / 81–100 com textos", async ({ page }) => {
    await page.goto(ROUTES.teacher.feedbackBands);
    const bands = [
      ["0", "50", "e2e revise os intervalos"],
      ["51", "80", "e2e bom progresso"],
      ["81", "100", "e2e excelente"],
    ];
    for (const [i, [from, to, text]] of bands.entries()) {
      const row = page.getByTestId(`feedback-band-${i}`);
      await row.getByLabel("De (%)").fill(from);
      await row.getByLabel("Até (%)").fill(to);
      await row.getByLabel("Texto").fill(text);
    }
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("status")).toContainText(/salv/i);
  });
});
