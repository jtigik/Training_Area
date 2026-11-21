/**
 * Usuários de teste por papel. Criados no banco isolado pelo global-setup
 * (upsert idempotente) com e-mails no domínio reservado `.test` e prefixo `e2e.`.
 */
export type Role = "STUDENT" | "TEACHER" | "ADMIN";
export type RoleKey = "aluno" | "professor" | "admin";

export interface TestUser {
  key: RoleKey;
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Painel esperado após o login (wireframe login.html). */
  home: string;
}

export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "E2e!Senha-Forte-2026";

export const USERS: Record<RoleKey, TestUser> = {
  aluno: {
    key: "aluno",
    id: "e2e_user_aluno",
    name: "E2E Aluno",
    email: "e2e.aluno@training-area.test",
    role: "STUDENT",
    home: "/aluno",
  },
  professor: {
    key: "professor",
    id: "e2e_user_professor",
    name: "E2E Professor",
    email: "e2e.professor@training-area.test",
    role: "TEACHER",
    home: "/professor/resultados",
  },
  admin: {
    key: "admin",
    id: "e2e_user_admin",
    name: "E2E Admin",
    email: "e2e.admin@training-area.test",
    role: "ADMIN",
    home: "/admin/usuarios",
  },
};

/** Segundo aluno, usado para testar acesso cruzado (TA-029) e desativação (TA-006). */
export const OTHER_STUDENT: TestUser = {
  key: "aluno",
  id: "e2e_user_aluno2",
  name: "E2E Aluno Dois",
  email: "e2e.aluno2@training-area.test",
  role: "STUDENT",
  home: "/aluno",
};

/** Arquivo de storage state (cookies) de cada papel, gerado por auth.setup.ts. */
export const authFile = (key: RoleKey) => `e2e/.auth/${key}.json`;

/** E-mail único por execução para testes que criam usuários (TA-001, TA-007). */
export const uniqueEmail = (label: string) =>
  `e2e.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@training-area.test`;
