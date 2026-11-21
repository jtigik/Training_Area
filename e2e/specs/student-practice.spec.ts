/**
 * E5/E6 — Fluxo central do aluno: trilha → exercício → testar fórmula → enviar →
 * correção → progresso → conclusão do nível + feedback.
 * Histórias: TA-020, TA-021, TA-022, TA-024, TA-025, TA-026.
 *
 * Dados: exercício `EXERCISE` de e2e/data/formulas.json (A1..A3 = 10/20/30, gabarito A4 = 60),
 * a ser semeado no banco isolado pelo global-setup quando os modelos de conjunto/exercício
 * existirem (rota esperada: /aluno/exercicios/<slug>).
 */
import { EXERCISE, FIXED_VALUE_FEEDBACK, casesBy } from "../data/formulas";
import { asRole, expect, test } from "../fixtures";
import { ROUTES } from "../support/routes";

const EXERCISE_URL = `${ROUTES.student.trail}/exercicios/${EXERCISE.slug}`;

test.describe("Trilha do aluno [TA-020, TA-024]", () => {
  asRole("aluno");

  test.fixme("[TA-020 AC1] mostra no máximo N exercícios do recorte configurado", async ({
    trail,
  }) => {
    await trail.goto();
    await expect(trail.levels).toBeVisible();
    // Conjunto semeado com quantidade 1 para Fundamental.
    await expect(trail.exerciseItems(EXERCISE.level)).toHaveCount(1);
  });

  test.fixme("[TA-020 AC2] exercícios não publicados não aparecem", async ({ trail }) => {
    await trail.goto();
    await expect(trail.levels.getByText("e2e — rascunho")).toHaveCount(0);
  });

  test.fixme("[TA-024 AC1] painel mostra feitos, restantes, acertos e status por nível", async ({
    trail,
  }) => {
    await trail.goto();
    const progress = trail.levelProgress(EXERCISE.level);
    await expect(progress).toHaveAttribute("aria-valuemin", "0");
    await expect(progress).toHaveAttribute("aria-valuetext", /\d+ de \d+/);
    await expect(trail.level(EXERCISE.level)).toContainText(/Não iniciado|Em andamento|Concluído/);
  });
});

test.describe("Grade e motor de fórmulas [TA-021]", () => {
  asRole("aluno");

  test.fixme("[TA-021 AC1] abre com os valores iniciais e células bloqueadas", async ({
    page,
    exercise,
  }) => {
    await page.goto(EXERCISE_URL);
    await expect(exercise.grid).toBeVisible();
    for (const [ref, value] of Object.entries(EXERCISE.grid)) {
      await expect(exercise.cell(ref)).toHaveText(String(value));
    }
    // Células do enunciado são bloqueadas: a barra de fórmulas fica somente leitura.
    await exercise.cell("A1").click();
    await expect(exercise.formulaBar).toHaveAccessibleName(/bloqueada/);
    await expect(exercise.formulaBar).not.toBeEditable();
  });

  for (const c of casesBy("correct")) {
    test.fixme(`[TA-021 AC2] ${c.id} ${c.input} calcula ${c.value} no navegador`, async ({
      page,
      exercise,
    }) => {
      await page.goto(EXERCISE_URL);
      await exercise.enter(EXERCISE.answerCell, c.input);
      await expect(exercise.cell(EXERCISE.answerCell)).toHaveText(String(c.value));
    });
  }

  for (const c of casesBy("invalid")) {
    test.fixme(`[TA-021 AC3] ${c.id} fórmula inválida ${c.input} mostra erro e não quebra`, async ({
      page,
      exercise,
    }) => {
      const pageErrors: Error[] = [];
      page.on("pageerror", (e) => pageErrors.push(e));
      await page.goto(EXERCISE_URL);
      await exercise.enter(EXERCISE.answerCell, c.input);
      await expect(page.getByRole("alert")).toContainText(/fórmula/i);
      await expect(exercise.grid).toBeVisible();
      expect(pageErrors).toEqual([]);
    });
  }

  for (const c of casesBy("unsupported")) {
    test.fixme(`[TA-021 AC4] ${c.id} função fora do MVP informa a limitação`, async ({
      page,
      exercise,
    }) => {
      await page.goto(EXERCISE_URL);
      await exercise.enter(EXERCISE.answerCell, c.input);
      await expect(page.getByRole("alert")).toContainText(/não (é )?suportad/i);
    });
  }

  test.fixme("[TA-029 AC3] testar sem enviar não grava tentativa", async ({ page, exercise }) => {
    await page.goto(EXERCISE_URL);
    await exercise.enter(EXERCISE.answerCell, "=SOMA(A1:A2)");
    await expect(exercise.feedback).toHaveCount(0);
    // A verificação no painel do professor está em teacher-results.spec.ts (TA-029 AC3).
  });
});

test.describe("Envio e correção [TA-022]", () => {
  asRole("aluno");

  for (const c of casesBy("correct")) {
    test.fixme(`[TA-022 AC1] ${c.id} resposta equivalente (${c.input}) → Correto`, async ({
      page,
      exercise,
    }) => {
      await page.goto(EXERCISE_URL);
      await exercise.enter(EXERCISE.answerCell, c.input);
      await exercise.submit.click();
      await exercise.expectCorrect();
    });
  }

  for (const c of casesBy("incorrect")) {
    test.fixme(`[TA-022 AC2] ${c.id} ${c.input} → Incorreto + dica, sem revelar gabarito`, async ({
      page,
      exercise,
    }) => {
      await page.goto(EXERCISE_URL);
      await exercise.enter(EXERCISE.answerCell, c.input);
      await exercise.submit.click();
      await exercise.expectIncorrect();
      await expect(exercise.feedback).toContainText(EXERCISE.hint);
      await expect(exercise.feedback).not.toContainText(EXERCISE.answerFormula);
    });
  }

  for (const c of casesBy("fixed_value")) {
    test.fixme(`[TA-022 AC2] ${c.id} valor fixo ${c.input} → Incorreto + "${FIXED_VALUE_FEEDBACK}"`, async ({
      page,
      exercise,
    }) => {
      // Decisão do PO (21/11): digitar o resultado (ex.: 60) sem fórmula é incorreto,
      // mesmo com o valor certo. O corretor do Backend 2 já bloqueia isso.
      await page.goto(EXERCISE_URL);
      await exercise.enter(EXERCISE.answerCell, c.input);
      await exercise.submit.click();
      await exercise.expectIncorrect();
      await expect(exercise.feedback).toContainText(new RegExp(FIXED_VALUE_FEEDBACK, "i"));
    });
  }

  test.fixme("[TA-022 AC3] servidor é a fonte da verdade quando diverge do cliente", async ({
    page,
    exercise,
  }) => {
    // Força o servidor a responder "incorreto" mesmo com a grade local calculando 60.
    await page.route("**/api/**/attempts", async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      expect(body).toHaveProperty("correct");
      await route.fulfill({ response: res, json: { ...body, correct: false } });
    });
    await page.goto(EXERCISE_URL);
    await exercise.enter(EXERCISE.answerCell, EXERCISE.answerFormula);
    await exercise.submit.click();
    await exercise.expectIncorrect();
  });

  test.fixme("[TA-022 AC1 + TA-024 AC2] acerto aparece no progresso ao voltar à trilha", async ({
    page,
    exercise,
    trail,
  }) => {
    await page.goto(EXERCISE_URL);
    await exercise.enter(EXERCISE.answerCell, EXERCISE.answerFormula);
    await exercise.submit.click();
    await exercise.expectCorrect();
    await trail.goto();
    await expect(trail.levelProgress(EXERCISE.level)).toHaveAttribute("aria-valuenow", /[1-9]/);
  });
});

test.describe("Conclusão do nível e feedback [TA-025, TA-026]", () => {
  asRole("aluno");
  test.describe.configure({ mode: "serial" });

  test.fixme("[TA-025 AC1] concluir a quantidade marca o nível; feedback aguarda o professor", async ({
    page,
    exercise,
    levelFeedback,
  }) => {
    await page.goto(EXERCISE_URL);
    await exercise.enter(EXERCISE.answerCell, EXERCISE.answerFormula);
    await exercise.submit.click();
    await exercise.expectCorrect();
    await page.getByRole("link", { name: /Ver feedback|Concluir nível/ }).click();
    await expect(levelFeedback.title).toContainText(EXERCISE.level);
    await expect(levelFeedback.summary).toBeVisible();
    // Feedback de IA só aparece após aprovação do professor (specs/ai-feedback-review.spec.ts).
    await expect(levelFeedback.message).toHaveCount(0);
    await expect(page.getByText(/em revisão|aguardando o professor/i)).toBeVisible();
  });

  test.fixme("[TA-025 AC2 / TA-020 AC3] nível concluído permanece concluído após nova tentativa", async ({
    page,
    exercise,
    trail,
  }) => {
    await page.goto(EXERCISE_URL);
    await exercise.enter(EXERCISE.answerCell, "=SOMA(A1:A2)");
    await exercise.submit.click();
    await trail.goto();
    await expect(trail.level(EXERCISE.level)).toContainText("Concluído");
  });
});
