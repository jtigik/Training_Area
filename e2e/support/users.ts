/**
 * Dados de seed próprios da suíte e2e (não dependem do seed do app).
 *
 * Papéis (decisão do PO, 21/11/2026):
 *   - Super Admin: global, tenantId = null; gere instituições (/superadmin/*).
 *   - Admin da instituição: gere usuários/parâmetros do próprio tenant (/admin/*).
 *   - Professor e Aluno: sempre ligados a um tenant.
 *
 * Duas instituições (e2e-inst-a, e2e-inst-b), cada uma com EXATAMENTE um Admin,
 * um Professor e alunos. Tudo com prefixo `e2e` e domínio reservado `.test`.
 * O global-setup grava o que o schema atual suporta e liga tenant/super admin
 * automaticamente quando o schema de feat/auth-modelo chegar (ver seed.ts).
 */
export type Role = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
export type TenantKey = "a" | "b";

/** Papéis com storage state de login: os de inst-a + super admin + papéis de inst-b. */
export type RoleKey = "superadmin" | "admin" | "professor" | "aluno";
export type SessionKey =
  | RoleKey
  | "aluno2"
  | "aluno-nd"
  | "aluno-ed"
  | "aluno-d"
  | "aluno-pd"
  | "admin-b"
  | "professor-b"
  | "aluno-b";

/** Conceito final de um nível (PO): refazer só é liberado em ND e ED. */
export type Concept = "ND" | "ED" | "D" | "PD";
export const REDO_ALLOWED: Record<Concept, boolean> = { ND: true, ED: true, D: false, PD: false };

/**
 * Faixas PROVISÓRIAS (PO, Q-G1/G2 — aguardam confirmação do Jeferson): % de exercícios
 * corretos na tentativa do nível. ND < 50, ED 50–69, D 70–89, PD ≥ 90. O seed usa um
 * percentual dentro de cada faixa (SEED_PERCENT) para os alunos alunoND/ED/D/PD.
 */
export const CONCEPT_MIN_PERCENT: Record<Concept, number> = { ND: 0, ED: 50, D: 70, PD: 90 };
export const SEED_PERCENT: Record<Concept, number> = { ND: 40, ED: 60, D: 80, PD: 100 };

export interface Tenant {
  key: TenantKey;
  id: string;
  slug: string;
  name: string;
}

export interface TestUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenant: TenantKey | null;
  /** Painel esperado após o login. */
  home: string;
  /** Conceito semeado no nível Fundamental (testes de refazer). */
  concept?: Concept;
}

export const TENANTS: Record<TenantKey, Tenant> = {
  a: { key: "a", id: "e2e_tenant_a", slug: "e2e-inst-a", name: "e2e Instituição A" },
  b: { key: "b", id: "e2e_tenant_b", slug: "e2e-inst-b", name: "e2e Instituição B" },
};

export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "E2e!Senha-Forte-2026";

const HOME = {
  SUPER_ADMIN: "/superadmin/instituicoes",
  ADMIN: "/admin/usuarios",
  TEACHER: "/professor/resultados",
  STUDENT: "/aluno",
} as const;

function user(
  tenant: TenantKey | null,
  slug: string,
  name: string,
  role: Role,
  concept?: Concept,
): TestUser {
  const prefix = tenant ? `e2e.${tenant}.` : "e2e.";
  return {
    id: `e2e_user_${tenant ?? "global"}_${slug.replace(/\W/g, "_")}`,
    name,
    email: `${prefix}${slug}@training-area.test`,
    role,
    tenant,
    home: HOME[role],
    concept,
  };
}

export const SUPER_ADMIN = user(null, "superadmin", "e2e Super Admin", "SUPER_ADMIN");

export const TENANT_USERS = {
  a: {
    admin: user("a", "admin", "e2e Admin A", "ADMIN"),
    professor: user("a", "professor", "e2e Professor A", "TEACHER"),
    aluno: user("a", "aluno", "e2e Aluno A", "STUDENT"),
    aluno2: user("a", "aluno2", "e2e Aluno A2", "STUDENT"),
    alunoND: user("a", "aluno-nd", "e2e Aluno A ND", "STUDENT", "ND"),
    alunoED: user("a", "aluno-ed", "e2e Aluno A ED", "STUDENT", "ED"),
    alunoD: user("a", "aluno-d", "e2e Aluno A D", "STUDENT", "D"),
    alunoPD: user("a", "aluno-pd", "e2e Aluno A PD", "STUDENT", "PD"),
  },
  b: {
    admin: user("b", "admin", "e2e Admin B", "ADMIN"),
    professor: user("b", "professor", "e2e Professor B", "TEACHER"),
    aluno: user("b", "aluno", "e2e Aluno B", "STUDENT"),
  },
} as const;

/** Atalhos usados pela maioria dos specs (instituição A). */
export const USERS: Record<RoleKey, TestUser> = {
  superadmin: SUPER_ADMIN,
  admin: TENANT_USERS.a.admin,
  professor: TENANT_USERS.a.professor,
  aluno: TENANT_USERS.a.aluno,
};
export const OTHER_STUDENT = TENANT_USERS.a.aluno2;

/** Usuários com sessão salva pelo auth.setup (um login por chave). */
export const SESSION_USERS: Record<SessionKey, TestUser> = {
  ...USERS,
  aluno2: TENANT_USERS.a.aluno2,
  "aluno-nd": TENANT_USERS.a.alunoND,
  "aluno-ed": TENANT_USERS.a.alunoED,
  "aluno-d": TENANT_USERS.a.alunoD,
  "aluno-pd": TENANT_USERS.a.alunoPD,
  "admin-b": TENANT_USERS.b.admin,
  "professor-b": TENANT_USERS.b.professor,
  "aluno-b": TENANT_USERS.b.aluno,
};

export const ALL_USERS: TestUser[] = [
  SUPER_ADMIN,
  ...Object.values(TENANT_USERS.a),
  ...Object.values(TENANT_USERS.b),
];

/** Arquivo de storage state (cookies) de cada sessão, gerado por auth.setup.ts. */
export const authFile = (key: SessionKey) => `e2e/.auth/${key}.json`;

/** E-mail único por execução para testes que criam usuários (TA-007). */
export const uniqueEmail = (label: string) =>
  `e2e.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@training-area.test`;

/** E-mail que nunca é semeado: usado no teste de conta não provisionada (OAuth). */
export const UNPROVISIONED_EMAIL = "e2e.nao-provisionado@training-area.test";

/**
 * IDs fixos dos recursos de domínio semeados por instituição (seed.ts, quando o schema
 * existir). Os testes de isolamento usam os IDs da inst-b como alvo de usuários da inst-a.
 */
export const TENANT_RESOURCES = {
  a: {
    set: "e2e_set_a",
    exercise: "e2e_exercise_a",
    section: "e2e_section_a",
    attempt: "e2e_attempt_a",
    feedback: "e2e_feedback_a",
    classroom: "e2e_class_a",
  },
  b: {
    set: "e2e_set_b",
    exercise: "e2e_exercise_b",
    section: "e2e_section_b",
    attempt: "e2e_attempt_b",
    feedback: "e2e_feedback_b",
    classroom: "e2e_class_b",
  },
} as const;
