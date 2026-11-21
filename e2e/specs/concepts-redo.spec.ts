/**
 * Conceitos de nível e refazer (decisão do PO, 21/11/2026):
 *   ND = Não Desenvolvido, ED = Em Desenvolvimento, D = Desenvolvido, PD = Plenamente Desenvolvido.
 *   Refazer o nível só é liberado para ND e ED — bloqueado na UI E na API para D e PD.
 * Complementa TA-025 AC2 (conclusão não é desfeita por novas tentativas).
 *
 * Dados (seed, quando o schema existir): alunos da inst-a com o nível Fundamental concluído
 * em cada conceito (support/users.ts: alunoND, alunoED, alunoD, alunoPD).
 * Testids: concept-badge (texto ND/ED/D/PD), redo-button.
 */
import { asRole, expect, test } from "../fixtures";
import { API } from "../support/routes";
import { REDO_ALLOWED, type Concept, type SessionKey } from "../support/users";

const LEVEL = "Fundamental";
const SESSIONS: Record<Concept, SessionKey> = {
  ND: "aluno-nd",
  ED: "aluno-ed",
  D: "aluno-d",
  PD: "aluno-pd",
};

for (const [concept, session] of Object.entries(SESSIONS) as [Concept, SessionKey][]) {
  test.describe(`Conceito ${concept} [CONCEITOS]`, () => {
    asRole(session);

    test.fixme(`[TA-025] trilha mostra o conceito ${concept} no nível concluído`, async ({
      trail,
    }) => {
      await trail.goto();
      await expect(trail.conceptBadge(LEVEL)).toHaveText(concept);
    });

    if (REDO_ALLOWED[concept]) {
      test.fixme(`[TA-025] ${concept}: botão Refazer disponível e reinicia a prática`, async ({
        page,
        trail,
      }) => {
        await trail.goto();
        await expect(trail.redoButton(LEVEL)).toBeEnabled();
        await trail.redoButton(LEVEL).click();
        await page.getByRole("button", { name: /Confirmar/ }).click();
        await expect(trail.level(LEVEL)).toContainText(/Em andamento/);
      });

      test.fixme(`[TA-025] ${concept}: API de refazer aceita`, async ({ request }) => {
        const res = await request.post(API.student.redo("fundamental"));
        expect(res.ok()).toBeTruthy();
      });
    } else {
      test.fixme(`[TA-025 AC2] ${concept}: sem botão Refazer na UI`, async ({ trail }) => {
        await trail.goto();
        await expect(trail.conceptBadge(LEVEL)).toHaveText(concept);
        await expect(trail.redoButton(LEVEL)).toHaveCount(0);
      });

      test.fixme(`[TA-025 AC2] ${concept}: API de refazer recusa e o conceito não muda`, async ({
        request,
        trail,
      }) => {
        const res = await request.post(API.student.redo("fundamental"));
        expect([403, 409, 422]).toContain(res.status());
        await trail.goto();
        await expect(trail.conceptBadge(LEVEL)).toHaveText(concept);
        await expect(trail.level(LEVEL)).toContainText(/Concluído/);
      });
    }
  });
}

test.describe("Conceitos no painel do professor [CONCEITOS]", () => {
  asRole("professor");

  test.fixme("[TA-028] professor vê o conceito de cada aluno no nível", async ({
    teacherResults,
  }) => {
    await teacherResults.goto();
    for (const concept of ["ND", "ED", "D", "PD"] as Concept[]) {
      await expect(
        teacherResults.table
          .getByTestId("concept-badge")
          .filter({ hasText: new RegExp(`^${concept}$`) }),
      ).not.toHaveCount(0);
    }
  });
});
