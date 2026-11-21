/**
 * Importação de exercício via .xlsx (escopo do PO, 21/11/2026 — antes TA-036/v1.1, agora MVP).
 * Tela: /professor/banco-exercicios (input data-testid="xlsx-import-input",
 * resultado data-testid="import-result").
 * Arquivos: e2e/data/xlsx (gerados por build_fixtures.py; modelo proposto no README).
 * Status: fixme até a importação existir.
 */
import path from "node:path";

import { EXERCISE } from "../data/formulas";
import { asRole, expect, test } from "../fixtures";
import { API } from "../support/routes";

const XLSX = (name: string) => path.join(__dirname, "..", "data", "xlsx", name);

test.describe("Importação .xlsx [IMPORT]", () => {
  asRole("professor");

  test.fixme("arquivo válido cria o exercício com grade, gabarito e metadados", async ({
    page,
    exerciseBank,
  }) => {
    await exerciseBank.goto();
    await exerciseBank.importFile(XLSX("exercicio-valido.xlsx"));
    await expect(exerciseBank.importResult).toContainText(
      /1 exercício importado|importado com sucesso/i,
    );
    await page.getByRole("link", { name: "e2e — Soma importada" }).click();
    await expect(page.getByLabel(/^Nível/)).toHaveValue(/Fundamental/);
    for (const [ref, value] of Object.entries(EXERCISE.grid)) {
      await expect(page.getByTestId(`cell-${ref}`)).toHaveText(String(value));
    }
    await expect(page.getByTestId(`answer-cell-${EXERCISE.answerCell}`)).toHaveValue(
      EXERCISE.answerFormula,
    );
  });

  test.fixme("importado entra como rascunho (não publica direto para alunos)", async ({
    page,
    exerciseBank,
  }) => {
    await exerciseBank.goto();
    await exerciseBank.importFile(XLSX("exercicio-valido.xlsx"));
    await expect(exerciseBank.importResult).toBeVisible();
    await expect(
      page.getByTestId("exercise-item").filter({ hasText: "e2e — Soma importada" }).first(),
    ).toContainText(/Rascunho/);
  });

  test.fixme("formato errado (.csv) é recusado com mensagem clara", async ({
    page,
    exerciseBank,
  }) => {
    await exerciseBank.goto();
    await exerciseBank.importFile(XLSX("exercicio-formato-errado.csv"));
    await expect(exerciseBank.importResult).toContainText(/\.xlsx|formato/i);
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test.fixme("arquivo corrompido é recusado sem quebrar a página", async ({
    page,
    exerciseBank,
  }) => {
    const errors: Error[] = [];
    page.on("pageerror", (e) => errors.push(e));
    await exerciseBank.goto();
    await exerciseBank.importFile(XLSX("exercicio-corrompido.xlsx"));
    await expect(exerciseBank.importResult).toContainText(
      /corrompid|inválid|não foi possível ler/i,
    );
    await expect(exerciseBank.importInput).toBeAttached();
    expect(errors).toEqual([]);
  });

  test.fixme("sem gabarito é recusado (TA-016 AC2) e nenhum exercício é criado", async ({
    page,
    exerciseBank,
  }) => {
    await exerciseBank.goto();
    const before = await page.getByTestId("exercise-item").count();
    await exerciseBank.importFile(XLSX("exercicio-sem-gabarito.xlsx"));
    await expect(exerciseBank.importResult).toContainText(/gabarito/i);
    await page.reload();
    await expect(page.getByTestId("exercise-item")).toHaveCount(before);
  });

  test.fixme("API de importação recusa formato errado com 4xx", async ({ request }) => {
    const res = await request.post(API.teacher.importXlsx, {
      multipart: {
        file: { name: "x.csv", mimeType: "text/csv", buffer: Buffer.from("A1,10\n") },
      },
    });
    expect([400, 415, 422]).toContain(res.status());
  });
});

test.describe("Importação .xlsx — permissão [IMPORT]", () => {
  asRole("aluno");

  test.fixme("aluno não importa (403)", async ({ request }) => {
    const res = await request.post(API.teacher.importXlsx, {
      multipart: {
        file: { name: "x.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("x") },
      },
    });
    expect(res.status()).toBe(403);
  });
});
