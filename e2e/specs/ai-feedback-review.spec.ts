/**
 * Feedback de IA com aprovação do professor (escopo do PO, 21/11/2026; substitui TA-026/TA-035
 * no que diz respeito à liberação): o feedback gerado por IA fica PENDENTE até o professor
 * aprovar. O aluno nunca vê feedback pendente ou rejeitado; o professor pode editar,
 * aprovar ou rejeitar na fila /professor/revisao-feedback.
 *
 * Dados (seed, quando o schema existir): para o aluno A, um feedback de IA pendente no nível
 * Fundamental. Testids: review-feedback-item, feedback-edit, feedback-approve, feedback-reject.
 * Rodam em sequência: o mesmo feedback passa por pendente → editado/aprovado.
 */
import { asRole, expect, test } from "../fixtures";
import { API, ROUTES } from "../support/routes";
import { TENANT_USERS, USERS } from "../support/users";

const LEVEL = "Fundamental";
const EDITED = `e2e feedback revisado ${Date.now()}`;

test.describe.configure({ mode: "serial" });

test.describe("Aluno antes da aprovação", () => {
  asRole("aluno");

  test.fixme("[TA-026] feedback pendente não aparece para o aluno (UI e API)", async ({
    page,
    request,
  }) => {
    await page.goto(`${ROUTES.student.trail}/niveis/fundamental/feedback`);
    await expect(page.getByRole("region", { name: "Seu feedback" })).toHaveCount(0);
    await expect(page.getByText(/em revisão|aguardando o professor/i)).toBeVisible();
    const res = await request.get(API.student.levelFeedback("fundamental"));
    // Pode ser 404 ou um corpo sem texto; nunca o texto gerado pela IA.
    if (res.ok()) expect((await res.json()).text ?? null).toBeNull();
  });
});

test.describe("Professor revisa", () => {
  asRole("professor");

  test.fixme("[TA-026] fila mostra o feedback pendente do aluno com o texto gerado", async ({
    feedbackReview,
  }) => {
    await feedbackReview.goto();
    const item = feedbackReview.itemFor(USERS.aluno.name);
    await expect(item).toHaveCount(1);
    await expect(item).toContainText(LEVEL);
    await expect(item).toContainText(/pendente/i);
  });

  test.fixme("[TA-026] professor edita e aprova; texto aprovado é o editado", async ({
    page,
    feedbackReview,
  }) => {
    await feedbackReview.goto();
    const item = feedbackReview.itemFor(USERS.aluno.name);
    await feedbackReview.edit(item).click();
    await page.getByRole("textbox", { name: /Feedback/ }).fill(EDITED);
    await feedbackReview.approve(item).click();
    await expect(feedbackReview.itemFor(USERS.aluno.name)).toHaveCount(0); // sai da fila de pendentes
  });

  test.fixme("[TA-026] rejeitar remove da fila e não libera para o aluno", async ({
    feedbackReview,
  }) => {
    // Usa o feedback pendente semeado para o aluno A2.
    await feedbackReview.goto();
    const item = feedbackReview.itemFor(TENANT_USERS.a.aluno2.name);
    await feedbackReview.reject(item).click();
    await expect(feedbackReview.itemFor(TENANT_USERS.a.aluno2.name)).toHaveCount(0);
  });
});

test.describe("Aluno depois da revisão", () => {
  test.describe("aprovado", () => {
    asRole("aluno");

    test.fixme("[TA-026] aluno vê exatamente o texto aprovado (editado pelo professor)", async ({
      page,
    }) => {
      await page.goto(`${ROUTES.student.trail}/niveis/fundamental/feedback`);
      await expect(page.getByRole("region", { name: "Seu feedback" })).toContainText(EDITED);
    });
  });
});

test.describe("Permissões da revisão", () => {
  asRole("aluno");

  test.fixme("aluno não acessa a fila nem aprova o próprio feedback (403)", async ({
    page,
    request,
  }) => {
    const res = await page.goto(ROUTES.teacher.feedbackReview);
    expect(res?.status()).toBe(403);
    expect((await request.get(API.teacher.feedbackReviews)).status()).toBe(403);
    expect((await request.post(`${API.teacher.feedbackReviews}/qualquer/approve`)).status()).toBe(
      403,
    );
  });
});

test.describe("Feedback rejeitado", () => {
  asRole("aluno2");

  test.fixme("[TA-026] aluno A2 nunca vê o feedback rejeitado (UI e API)", async ({
    page,
    request,
  }) => {
    await page.goto(`${ROUTES.student.trail}/niveis/fundamental/feedback`);
    await expect(page.getByRole("region", { name: "Seu feedback" })).toHaveCount(0);
    const res = await request.get(API.student.levelFeedback("fundamental"));
    if (res.ok()) expect((await res.json()).text ?? null).toBeNull();
  });
});
