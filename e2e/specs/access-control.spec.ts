/**
 * E1 — Isolamento de rotas e APIs por papel (TA-003), incluindo acesso direto por URL,
 * e negativos de TA-002 / TA-010 / TA-029 / TA-031.
 *
 * Matriz (página → papéis com acesso):
 *   /aluno                 → aluno
 *   /professor/*           → professor (admin: a confirmar na matriz de permissões)
 *   /admin/*               → Admin da instituição (escopo do próprio tenant)
 *   /superadmin/*          → Super Admin (global, tenantId nulo)
 * Isolamento ENTRE instituições: specs/tenant-isolation.spec.ts.
 */
import { asAnonymous, asRole, expect, test } from "../fixtures";
import { API, PROTECTED_PAGES, ROUTES } from "../support/routes";
import { OTHER_STUDENT, USERS } from "../support/users";

const ALL_PROTECTED = [
  ...PROTECTED_PAGES.aluno,
  ...PROTECTED_PAGES.professor,
  ...PROTECTED_PAGES.admin,
  ...PROTECTED_PAGES.superadmin,
];

const PROTECTED_APIS = [
  { method: "GET", url: API.admin.users },
  { method: "GET", url: API.admin.config },
  { method: "GET", url: API.teacher.sections },
  { method: "GET", url: API.teacher.sets },
  { method: "GET", url: API.teacher.results },
  { method: "GET", url: API.superAdmin.institutions },
] as const;

test.describe("Visitante anônimo [TA-003 AC3]", () => {
  asAnonymous();

  for (const path of ALL_PROTECTED) {
    test.fixme(`[TA-003] acesso direto a ${path} redireciona ao login com ?voltar=`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL((url) => url.pathname === ROUTES.login);
      expect(new URL(page.url()).searchParams.get("voltar")).toBe(path);
    });
  }

  for (const api of PROTECTED_APIS) {
    test.fixme(`[TA-003 AC3] ${api.method} ${api.url} sem token → 401`, async ({ request }) => {
      const res = await request.fetch(api.url, { method: api.method });
      expect(res.status()).toBe(401);
    });
  }

  test.fixme("[TA-003 AC3] token inválido → 401", async ({ request }) => {
    const res = await request.get(API.teacher.results, {
      headers: { Authorization: "Bearer token-invalido", Cookie: "session=forjado" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("Aluno [TA-003 AC1]", () => {
  asRole("aluno");

  for (const path of [
    ...PROTECTED_PAGES.professor,
    ...PROTECTED_PAGES.admin,
    ...PROTECTED_PAGES.superadmin,
  ]) {
    test.fixme(`[TA-003 AC1] aluno abrindo ${path} por URL recebe 403`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(403);
      await expect(page.getByRole("heading", { name: /Acesso negado|403/ })).toBeVisible();
    });
  }

  for (const api of PROTECTED_APIS) {
    test.fixme(`[TA-003 AC1] aluno: ${api.method} ${api.url} → 403`, async ({ request }) => {
      const res = await request.fetch(api.url, { method: api.method });
      expect(res.status()).toBe(403);
    });
  }

  test.fixme("[TA-003 AC1] menu do aluno não mostra itens de professor/admin", async ({
    page,
    shell,
  }) => {
    await page.goto(ROUTES.student.trail);
    await expect(shell.navLink("Minha trilha")).toBeVisible();
    await expect(shell.navLink(/Resultados|Conjuntos|Usuários|Configurações/)).toHaveCount(0);
  });

  test.fixme("[TA-010 AC4] aluno não cria seção via API (403)", async ({ request }) => {
    const res = await request.post(API.teacher.sections, {
      data: { title: "e2e hack", body: "x" },
    });
    expect(res.status()).toBe(403);
  });

  test.fixme("[TA-002 AC2] aluno não altera papel via API (403) e nada muda", async ({
    request,
  }) => {
    const res = await request.patch(API.admin.user(USERS.aluno.id), { data: { role: "ADMIN" } });
    expect(res.status()).toBe(403);
  });

  test.fixme("[TA-029 AC2] aluno não abre o detalhe de outro aluno (403)", async ({ request }) => {
    const res = await request.get(API.teacher.studentDetail(OTHER_STUDENT.id));
    expect(res.status()).toBe(403);
  });
});

test.describe("Professor [TA-003]", () => {
  asRole("professor");

  for (const path of [...PROTECTED_PAGES.admin, ...PROTECTED_PAGES.superadmin]) {
    test.fixme(`[TA-003] professor abrindo ${path} por URL recebe 403`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(403);
    });
  }

  test.fixme("[TA-002 AC2 / TA-008] professor: APIs de admin → 403", async ({ request }) => {
    expect((await request.get(API.admin.users)).status()).toBe(403);
    expect((await request.put(API.admin.config, { data: { instanceName: "e2e" } })).status()).toBe(
      403,
    );
    expect(
      (await request.patch(API.admin.user(USERS.aluno.id), { data: { role: "TEACHER" } })).status(),
    ).toBe(403);
  });

  test.fixme("[TA-003 AC2] professor vê resultados de todos os alunos da instância", async ({
    teacherResults,
  }) => {
    await teacherResults.goto();
    await expect(teacherResults.studentRow(USERS.aluno.name)).toBeVisible();
    await expect(teacherResults.studentRow(OTHER_STUDENT.name)).toBeVisible();
  });

  test.fixme("[TA-003] menu do professor não mostra itens de admin", async ({ page, shell }) => {
    await page.goto(ROUTES.teacher.results);
    await expect(shell.navLink("Resultados")).toBeVisible();
    await expect(shell.navLink(/Usuários|Configurações/)).toHaveCount(0);
  });
});

test.describe("Admin da instituição [TA-003]", () => {
  asRole("admin");

  for (const path of PROTECTED_PAGES.admin) {
    test.fixme(`[TA-003] Admin da instituição acessa ${path}`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
    });
  }

  for (const path of PROTECTED_PAGES.superadmin) {
    test.fixme(`[TA-003] Admin da instituição abrindo ${path} por URL recebe 403`, async ({
      page,
    }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(403);
    });
  }

  test.fixme("[TA-003] Admin da instituição: API do Super Admin → 403 e menu sem Instituições", async ({
    page,
    request,
    shell,
  }) => {
    expect((await request.get(API.superAdmin.institutions)).status()).toBe(403);
    await page.goto(ROUTES.admin.users);
    await expect(shell.navLink(/Instituições/)).toHaveCount(0);
  });
});

test.describe("Super Admin [TA-003]", () => {
  asRole("superadmin");

  for (const path of PROTECTED_PAGES.superadmin) {
    test.fixme(`[TA-003] Super Admin acessa ${path}`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
    });
  }
});
