/**
 * CRÍTICO — Isolamento multi-tenant (decisão do PO, 21/11/2026):
 * um usuário de uma instituição não pode ver NADA de outra instituição — alunos, turmas,
 * exercícios, conjuntos, tentativas e feedback — nem pela UI, nem por URL direta, nem pela
 * API com IDs da outra instituição. O Admin da instituição fica limitado ao próprio tenant;
 * o Super Admin (tenantId nulo) enxerga todas.
 *
 * Dados: seed da suíte (support/users.ts) — e2e-inst-a e e2e-inst-b, cada uma com 1 Admin,
 * 1 Professor e alunos, e recursos com IDs fixos (TENANT_RESOURCES).
 * Status: fixme até o schema com tenant (feat/auth-modelo) e as rotas existirem.
 *
 * PO (Q-T1/Q-T2): recurso de outra instituição responde 404 (não revela que existe), e a
 * instituição vem da CONTA logada — path, query, subdomínio ou header não concedem acesso.
 * PO (Q-M1): o Super Admin gere instituições, admins e conteúdo global, mas NÃO vê respostas
 * de alunos.
 */
import type { APIResponse } from "@playwright/test";

import { EXERCISE } from "../data/formulas";
import { asRole, expect, test } from "../fixtures";
import { API, ROUTES } from "../support/routes";
import { TENANTS, TENANT_RESOURCES, TENANT_USERS, type SessionKey } from "../support/users";

const B = TENANT_RESOURCES.b;
const B_USERS = TENANT_USERS.b;
const A_USERS = TENANT_USERS.a;

/** Recurso de outra instituição: 404 e nada do dado no corpo. */
async function expectDenied(res: APIResponse, leaked: string[] = []) {
  expect(res.status()).toBe(404);
  const body = await res.text();
  for (const value of leaked) expect(body).not.toContain(value);
}

/** Leituras por ID de recursos da inst-b, por papel com acesso ao endpoint no próprio tenant. */
const B_READS_BY_VIEWER: Record<string, { what: string; url: string }[]> = {
  professor: [
    { what: "aluno (detalhe de resultados)", url: API.teacher.studentDetail(B_USERS.aluno.id) },
    { what: "conjunto", url: API.teacher.set(B.set) },
    { what: "exercício", url: API.teacher.exercise(B.exercise) },
    { what: "feedback em revisão", url: API.teacher.feedbackReview(B.feedback) },
  ],
  // Admin da instituição vê resultados só para leitura (PO, Q-M4) e gere usuários.
  admin: [
    { what: "aluno (detalhe de resultados)", url: API.teacher.studentDetail(B_USERS.aluno.id) },
    { what: "usuário", url: API.admin.user(B_USERS.aluno.id) },
  ],
};

/** Listagens que não podem conter nada da inst-b. */
const LISTS = [
  API.teacher.students,
  API.teacher.results,
  API.teacher.sets,
  API.teacher.feedbackReviews,
];

for (const [viewer, reads] of Object.entries(B_READS_BY_VIEWER) as [
  SessionKey,
  { what: string; url: string }[],
][]) {
  test.describe(`inst-a ${viewer} × dados da inst-b [ISOLAMENTO]`, () => {
    asRole(viewer);

    for (const read of reads) {
      test.fixme(`[TA-003] ${viewer} da inst-a: GET ${read.what} da inst-b por ID → 404 sem vazar`, async ({
        request,
      }) => {
        await expectDenied(await request.get(read.url), [B_USERS.aluno.email, B_USERS.aluno.name]);
      });
    }

    test.fixme(`[TA-003] ${viewer} da inst-a: URL/query/header da inst-b não trocam a instituição`, async ({
      request,
      page,
    }) => {
      // A instituição vem da conta logada (Q-T2).
      const read = reads[0];
      await expectDenied(
        await request.get(`${read.url}?tenant=${TENANTS.b.slug}&tenantId=${TENANTS.b.id}`),
      );
      await expectDenied(await request.get(read.url, { headers: { "x-tenant-id": TENANTS.b.id } }));
      const res = await page.goto(`/${TENANTS.b.slug}${ROUTES.teacher.results}`);
      expect(res?.status()).toBe(404);
      await page.goto(`${ROUTES.teacher.results}?tenant=${TENANTS.b.slug}`);
      await expect(page.getByText(B_USERS.aluno.name)).toHaveCount(0);
    });
  });
}

test.describe("Professor da inst-a [ISOLAMENTO]", () => {
  asRole("professor");

  for (const url of LISTS) {
    test.fixme(`[TA-003] listagem ${url} não contém nada da inst-b`, async ({ request }) => {
      const res = await request.get(url);
      expect(res.ok()).toBeTruthy();
      const body = await res.text();
      for (const leaked of [
        B_USERS.aluno.email,
        B_USERS.aluno.name,
        B.set,
        B.exercise,
        TENANTS.b.slug,
      ]) {
        expect(body).not.toContain(leaked);
      }
    });
  }

  test.fixme("[TA-003] escrita com IDs da inst-b é recusada e nada muda", async ({ request }) => {
    await expectDenied(
      await request.patch(API.teacher.set(B.set), { data: { name: "e2e invadido" } }),
    );
    await expectDenied(
      await request.patch(API.teacher.exercise(B.exercise), { data: { title: "e2e invadido" } }),
    );
    await expectDenied(await request.post(`${API.teacher.feedbackReview(B.feedback)}/approve`));
    await expectDenied(await request.post(`${API.teacher.set(B.set)}/publish`));
  });

  test.fixme("[TA-028] UI: painel de resultados mostra só alunos da inst-a", async ({
    teacherResults,
  }) => {
    await teacherResults.goto();
    await expect(teacherResults.studentRow(A_USERS.aluno.name)).toBeVisible();
    await expect(teacherResults.studentRow(B_USERS.aluno.name)).toHaveCount(0);
  });

  test.fixme("[TA-003] UI: URL direta de conjunto/exercício/aluno da inst-b → não encontrado", async ({
    page,
  }) => {
    for (const path of [
      `${ROUTES.teacher.sets}/${B.set}`,
      `${ROUTES.teacher.sets}/${B.set}/exercicios/${B.exercise}`,
      ROUTES.teacher.studentDetail(B_USERS.aluno.id),
    ]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(404);
      await expect(page.getByText(B_USERS.aluno.name)).toHaveCount(0);
    }
  });

  test.fixme("[TA-003] UI: fila de revisão de feedback e banco de exercícios sem itens da inst-b", async ({
    feedbackReview,
    exerciseBank,
    page,
  }) => {
    await feedbackReview.goto();
    await expect(feedbackReview.itemFor(B_USERS.aluno.name)).toHaveCount(0);
    await exerciseBank.goto();
    await expect(page.getByText(/e2e.*inst(ituição)? B/i)).toHaveCount(0);
  });
});

test.describe("Aluno da inst-a [ISOLAMENTO]", () => {
  asRole("aluno");

  test.fixme("[TA-020] trilha não mostra conjuntos/exercícios da inst-b", async ({
    page,
    trail,
  }) => {
    await trail.goto();
    await expect(page.getByText(/inst(ituição)? B/i)).toHaveCount(0);
    const res = await page.goto(ROUTES.student.exercise(B.exercise));
    expect(res?.status()).toBe(404);
  });

  test.fixme("[TA-022] não envia tentativa para exercício da inst-b", async ({ request }) => {
    await expectDenied(
      await request.post(`/api/student/exercises/${B.exercise}/attempts`, {
        data: { cells: { A4: "=1" } },
      }),
    );
  });
});

test.describe("Admin da inst-a [ISOLAMENTO]", () => {
  asRole("admin");

  test.fixme("[TA-006] lista de usuários só tem a inst-a; busca por e-mail da inst-b não acha", async ({
    adminUsers,
  }) => {
    await adminUsers.goto();
    await expect(adminUsers.row(A_USERS.professor.email)).toBeVisible();
    await adminUsers.search.fill(B_USERS.aluno.email);
    await expect(adminUsers.row(B_USERS.aluno.email)).toHaveCount(0);
  });

  test.fixme("[TA-002/TA-006] não altera papel nem desativa usuário da inst-b", async ({
    request,
  }) => {
    await expectDenied(
      await request.patch(API.admin.user(B_USERS.professor.id), { data: { role: "ADMIN" } }),
    );
    await expectDenied(
      await request.patch(API.admin.user(B_USERS.aluno.id), { data: { active: false } }),
    );
  });

  test.fixme("[TA-007] não cria usuário na inst-b (tenant do corpo é ignorado/recusado)", async ({
    request,
  }) => {
    const res = await request.post(API.admin.users, {
      data: {
        name: "e2e intruso",
        email: "e2e.intruso@training-area.test",
        role: "STUDENT",
        tenantId: TENANTS.b.id,
      },
    });
    if (res.ok()) {
      // Se aceitar, o usuário tem de nascer na inst-a, nunca na inst-b.
      expect((await res.json()).tenantId).not.toBe(TENANTS.b.id);
    } else {
      expect([400, 403, 422]).toContain(res.status());
    }
  });

  test.fixme("[TA-007] e-mail é único na plataforma: convidar e-mail da inst-b dá erro claro", async ({
    request,
  }) => {
    // PO (Q-O1): não é permitido; a mensagem deve ser clara (o e-mail já está em uso).
    const res = await request.post(API.admin.users, {
      data: { name: "e2e duplicado", email: B_USERS.aluno.email, role: "STUDENT" },
    });
    expect(res.status()).toBe(409);
    expect(JSON.stringify(await res.json())).toMatch(/e-?mail.*(já|em uso|cadastrad)/i);
  });

  test.fixme("[TA-008] parâmetros salvos pela inst-a não mudam a inst-b", async ({
    request,
    browser,
  }) => {
    const name = `e2e A ${Date.now()}`;
    expect(
      (await request.put(API.admin.config, { data: { instanceName: name } })).ok(),
    ).toBeTruthy();
    const ctxB = await browser.newContext({ storageState: "e2e/.auth/admin-b.json" });
    const cfgB = await (await ctxB.request.get(API.admin.config)).json();
    expect(cfgB.instanceName).not.toBe(name);
    await ctxB.close();
  });
});

test.describe("Inst-b enxerga só a inst-b (simetria) [ISOLAMENTO]", () => {
  asRole("professor-b");

  test.fixme("[TA-003] professor da inst-b não lê aluno/conjunto da inst-a", async ({
    request,
  }) => {
    await expectDenied(await request.get(API.teacher.studentDetail(A_USERS.aluno.id)), [
      A_USERS.aluno.email,
    ]);
    await expectDenied(await request.get(API.teacher.set(TENANT_RESOURCES.a.set)));
  });
});

test.describe("Super Admin: instituições sim, respostas de alunos não", () => {
  asRole("superadmin");

  test.fixme("lista as duas instituições em /superadmin/instituicoes", async ({ institutions }) => {
    await institutions.goto();
    await expect(institutions.item(TENANTS.a.name)).toBeVisible();
    await expect(institutions.item(TENANTS.b.name)).toBeVisible();
  });

  test.fixme("API do Super Admin retorna as duas instituições", async ({ request }) => {
    const res = await request.get(API.superAdmin.institutions);
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body).toContain(TENANTS.a.slug);
    expect(body).toContain(TENANTS.b.slug);
  });

  test.fixme("gere os Admins de qualquer instituição", async ({ request }) => {
    for (const u of [A_USERS.admin, B_USERS.admin]) {
      expect((await request.get(API.admin.user(u.id))).ok()).toBeTruthy();
    }
  });

  test.fixme("[Q-M1] NÃO vê respostas/tentativas de alunos (API)", async ({ request }) => {
    for (const u of [A_USERS.aluno, B_USERS.aluno]) {
      const res = await request.get(API.teacher.studentDetail(u.id));
      expect([403, 404]).toContain(res.status());
      expect(await res.text()).not.toContain(EXERCISE.answerFormula);
    }
    expect([403, 404]).toContain((await request.get(API.teacher.results)).status());
  });

  test.fixme("[Q-M1] NÃO abre o painel de resultados nem a fila de revisão (UI)", async ({
    page,
  }) => {
    for (const path of [
      ROUTES.teacher.results,
      ROUTES.teacher.studentDetail(A_USERS.aluno.id),
      ROUTES.teacher.feedbackReview,
    ]) {
      const res = await page.goto(path);
      expect([403, 404]).toContain(res?.status());
    }
  });
});
