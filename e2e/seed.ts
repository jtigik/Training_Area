/**
 * Seed próprio da suíte e2e, adaptável ao schema.
 *
 * Hoje (main) o schema só tem `users` com Role = STUDENT | TEACHER | ADMIN, sem tenant.
 * Quando o Backend 1 publicar o schema multi-tenant (feat/auth-modelo), este seed passa
 * a gravar instituições, `tenant_id` dos usuários e o Super Admin SEM mudar os dados
 * declarados em support/users.ts: ele lê o information_schema e grava só o que existe.
 * Se os nomes reais forem outros, ajuste apenas SCHEMA_CANDIDATES abaixo.
 *
 * Nada é apagado: tudo é upsert por chave natural (slug / e-mail).
 */
import type { Client } from "pg";

import { ALL_USERS, E2E_PASSWORD, TENANTS, type TestUser } from "./support/users";

const SCHEMA_CANDIDATES = {
  tenantTable: ["tenants", "institutions", "instituicoes"],
  userTenantColumn: ["tenant_id", "institution_id"],
  /** Papel lógico da suíte → rótulos possíveis do enum Role (main: ADMIN/TEACHER/STUDENT;
   *  feat/auth-modelo b82f851: SUPER_ADMIN/INSTITUTION_ADMIN/PROFESSOR/ALUNO). */
  roles: {
    SUPER_ADMIN: ["SUPER_ADMIN", "SUPERADMIN"],
    ADMIN: ["INSTITUTION_ADMIN", "ADMIN"],
    TEACHER: ["PROFESSOR", "TEACHER"],
    STUDENT: ["ALUNO", "STUDENT"],
  },
};

const LEGACY_E2E_EMAILS = ["aluno", "aluno2", "professor", "admin"].map(
  (k) => `e2e.${k}@training-area.test`,
);

export interface SeedReport {
  tenants: "seeded" | "skipped: schema sem tabela de instituições";
  userTenantColumn: string | null;
  superAdmin: "seeded" | "skipped: enum Role sem SUPER_ADMIN";
  users: number;
  passwordHash: "seeded" | "skipped: defina E2E_PASSWORD_HASH (hash de E2E_PASSWORD)";
  pending: string[];
}

async function columnsOf(db: Client, table: string) {
  const { rows } = await db.query<{
    column_name: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    `SELECT column_name, is_nullable, column_default FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return rows;
}

async function enumLabels(db: Client, enumName: string) {
  const { rows } = await db.query<{ enumlabel: string }>(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = $1`,
    [enumName],
  );
  return rows.map((r) => r.enumlabel);
}

/** INSERT … ON CONFLICT (conflict) DO UPDATE com só as colunas que existem na tabela. */
async function upsert(
  db: Client,
  table: string,
  conflict: string,
  data: Record<string, unknown>,
  casts: Record<string, string> = {},
) {
  const cols = await columnsOf(db, table);
  const existing = new Set(cols.map((c) => c.column_name));
  if (existing.has("updated_at") && !("updated_at" in data)) data.updated_at = new Date();
  const keys = Object.keys(data).filter((k) => existing.has(k));
  const missingRequired = cols.filter(
    (c) => c.is_nullable === "NO" && c.column_default === null && !keys.includes(c.column_name),
  );
  if (missingRequired.length) {
    throw new Error(
      `[e2e seed] ${table}: colunas obrigatórias sem valor no seed: ${missingRequired
        .map((c) => c.column_name)
        .join(", ")} — atualize e2e/seed.ts`,
    );
  }
  const placeholders = keys.map((k, i) => `$${i + 1}${casts[k] ? `::"${casts[k]}"` : ""}`);
  const updates = keys
    .filter((k) => k !== conflict && k !== "id")
    .map((k) => `"${k}" = EXCLUDED."${k}"`);
  await db.query(
    `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${placeholders.join(", ")})
     ON CONFLICT ("${conflict}") DO ${updates.length ? `UPDATE SET ${updates.join(", ")}` : "NOTHING"}`,
    keys.map((k) => data[k]),
  );
}

export async function seed(db: Client): Promise<SeedReport> {
  const pending: string[] = [];
  const tables = (
    await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    )
  ).rows.map((r) => r.table_name);

  // 1) Instituições
  const tenantTable = SCHEMA_CANDIDATES.tenantTable.find((t) => tables.includes(t)) ?? null;
  if (tenantTable) {
    for (const t of Object.values(TENANTS)) {
      await upsert(db, tenantTable, "slug", { id: t.id, slug: t.slug, name: t.name });
    }
  } else {
    pending.push("instituições (tabela de tenant ainda não existe)");
  }
  const tenantIdBySlug = new Map<string, string>();
  if (tenantTable) {
    const { rows } = await db.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM "${tenantTable}" WHERE slug = ANY($1)`,
      [Object.values(TENANTS).map((t) => t.slug)],
    );
    rows.forEach((r) => tenantIdBySlug.set(r.slug, r.id));
  }

  // 2) Usuários
  // Remove só os usuários do seed antigo da própria suíte (antes do multi-tenant),
  // que ficariam como ADMIN sem instituição no banco e2e. Nunca toca o banco de dev.
  await db.query(`DELETE FROM users WHERE email = ANY($1)`, [LEGACY_E2E_EMAILS]);
  const userCols = new Set((await columnsOf(db, "users")).map((c) => c.column_name));
  const tenantCol = SCHEMA_CANDIDATES.userTenantColumn.find((c) => userCols.has(c)) ?? null;
  if (!tenantCol) pending.push("users.tenant_id (usuários semeados sem instituição)");
  const roles = await enumLabels(db, "Role");
  const roleLabel = (role: TestUser["role"]) =>
    SCHEMA_CANDIDATES.roles[role].find((r) => roles.includes(r)) ?? null;
  const superRole = roleLabel("SUPER_ADMIN");
  if (!superRole) pending.push("Super Admin (enum Role sem SUPER_ADMIN)");

  // feat/auth-modelo usa Better Auth: a senha fica em accounts.password (scrypt), não em
  // users.password_hash. TODO: quando o schema chegar, gravar a conta "credential" aqui.
  const passwordHash = process.env.E2E_PASSWORD_HASH ?? null;
  if (!passwordHash) pending.push("password_hash (login por senha no auth.setup)");
  void E2E_PASSWORD; // o hash deve corresponder a esta senha

  let count = 0;
  const dbRole = (u: TestUser) => roleLabel(u.role);
  for (const u of ALL_USERS) {
    const role = dbRole(u);
    if (!role) continue;
    const data: Record<string, unknown> = {
      id: u.id,
      email: u.email,
      name: u.name,
      role,
      active: true,
    };
    if (tenantCol) data[tenantCol] = u.tenant ? tenantIdBySlug.get(TENANTS[u.tenant].slug) : null;
    if (passwordHash) data.password_hash = passwordHash;
    await upsert(db, "users", "email", data, { role: "Role" });
    count++;
  }

  // 3) Dados de domínio (conjuntos, exercícios, tentativas, conceitos, feedback de IA)
  // TODO(feat/auth-modelo): semear por instituição:
  //   - conjunto publicado "e2e-conjunto" (Fundamental, Muito fácil, quantidade 1) com o
  //     exercício de e2e/data/formulas.json;
  //   - tentativas + conceito do nível Fundamental para alunoND/ED/D/PD (support/users.ts);
  //   - um feedback de IA "pendente" e um "rejeitado" para o aluno A (revisão do professor);
  //   - um conjunto/exercício/tentativa na inst-b, usados como alvo dos testes de isolamento.
  pending.push("conjuntos/exercícios/tentativas/conceitos/feedback (schema ainda não existe)");

  return {
    tenants: tenantTable ? "seeded" : "skipped: schema sem tabela de instituições",
    userTenantColumn: tenantCol,
    superAdmin: superRole ? "seeded" : "skipped: enum Role sem SUPER_ADMIN",
    users: count,
    passwordHash: passwordHash
      ? "seeded"
      : "skipped: defina E2E_PASSWORD_HASH (hash de E2E_PASSWORD)",
    pending,
  };
}
