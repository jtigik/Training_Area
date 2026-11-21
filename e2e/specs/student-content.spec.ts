/**
 * E3 — Leitura de conteúdo pelo aluno (TA-011, TA-012).
 */
import { asRole, expect, test } from "../fixtures";

test.describe("Conteúdo do aluno [TA-011, TA-012]", () => {
  asRole("aluno");

  test.fixme("[TA-011 AC1] lista só seções publicadas, na ordem definida", async ({
    studentContent,
  }) => {
    await studentContent.goto();
    const titles = await studentContent.sections.allInnerTexts();
    expect(titles.filter((t) => t.startsWith("e2e"))).toEqual(
      [...titles.filter((t) => t.startsWith("e2e"))].sort(), // seções semeadas com títulos ordenados e2e-01, e2e-02...
    );
    await expect(studentContent.sections.filter({ hasText: "e2e rascunho" })).toHaveCount(0);
  });

  test.fixme("[TA-011 AC2] Markdown e imagens são renderizados", async ({
    page,
    studentContent,
  }) => {
    await studentContent.goto();
    await studentContent.sections.first().click();
    await expect(page.getByRole("article").getByRole("heading").first()).toBeVisible();
    await expect(page.getByRole("article").getByRole("img").first()).toBeVisible();
    await expect(page.getByRole("article")).not.toContainText("## ");
  });

  test.fixme("[TA-011 AC3] sem seções publicadas mostra orientação para aguardar", async ({
    studentContent,
  }) => {
    // Requer instância sem seções publicadas (rodar com banco e2e recém-criado).
    await studentContent.goto();
    await expect(studentContent.emptyState).toBeVisible();
  });

  test.fixme("[TA-012 AC1+AC2] seção aparece no nível vinculado; sem nível aparece na lista geral", async ({
    page,
    studentContent,
  }) => {
    await studentContent.goto();
    await expect(studentContent.sections.filter({ hasText: "e2e transversal" })).toBeVisible();
    await page.getByRole("link", { name: "Fundamental" }).click();
    await expect(studentContent.sections.filter({ hasText: "e2e fundamental" })).toBeVisible();
  });
});
