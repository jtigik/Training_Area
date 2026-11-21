import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient, type Prisma, type Role } from "../src/generated/prisma/client";

/**
 * Seed de DESENVOLVIMENTO (idempotente):
 *  - 1 instituição "Escola Demo";
 *  - 1 usuário por papel (SUPER_ADMIN sem tenant; os demais na Escola Demo);
 *  - banco inicial GLOBAL (tenantId nulo): exercícios e uma seção de conteúdo;
 *  - 1 conjunto com nível Fundamental e cota padrão na Escola Demo.
 *
 * Login: no lançamento é Google/Microsoft. Para dev/E2E, o seed cria também
 * credencial de e-mail+senha, usável só com AUTH_EMAIL_PASSWORD_ENABLED=true.
 * Senhas padrão são públicas (README) e só para dev; sobrescreva com
 * SEED_*_PASSWORD. Em produção o seed exige as variáveis.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não definida");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEMO_TENANT = {
  id: "tenant-escola-demo",
  name: "Escola Demo",
  slug: "escola-demo",
  emailDomains: ["escola-demo.local"],
};

interface SeedUser {
  email: string;
  name: string;
  role: Role;
  tenantId: string | null;
  passwordEnv: string;
  devPassword: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: "admin@training-area.local",
    name: "Super Admin",
    role: "SUPER_ADMIN",
    tenantId: null,
    passwordEnv: "SEED_SUPER_ADMIN_PASSWORD",
    devPassword: "SuperAdmin@Dev123",
  },
  {
    email: "admin@escola-demo.local",
    name: "Admin Escola Demo",
    role: "INSTITUTION_ADMIN",
    tenantId: DEMO_TENANT.id,
    passwordEnv: "SEED_INSTITUTION_ADMIN_PASSWORD",
    devPassword: "Admin@Dev123",
  },
  {
    email: "professor@escola-demo.local",
    name: "Professora Demo",
    role: "PROFESSOR",
    tenantId: DEMO_TENANT.id,
    passwordEnv: "SEED_PROFESSOR_PASSWORD",
    devPassword: "Professor@Dev123",
  },
  {
    email: "aluno@escola-demo.local",
    name: "Aluno Demo",
    role: "ALUNO",
    tenantId: DEMO_TENANT.id,
    passwordEnv: "SEED_ALUNO_PASSWORD",
    devPassword: "Aluno@Dev123",
  },
];

type GlobalExercise = Pick<
  Prisma.ExerciseUncheckedCreateInput,
  "id" | "title" | "statement" | "initialSheet" | "expectedResult" | "hint" | "level" | "difficulty"
>;

/** Banco inicial: exercícios globais (tenantId nulo, isGlobal = true). */
const GLOBAL_EXERCISES: GlobalExercise[] = [
  {
    id: "global-ex-soma",
    title: "Somar vendas do trimestre",
    statement: "Em **B4**, some as vendas de B1 a B3.",
    initialSheet: {
      cells: {
        A1: { value: "Jan" },
        B1: { value: 120 },
        A2: { value: "Fev" },
        B2: { value: 95 },
        A3: { value: "Mar" },
        B3: { value: 140 },
        A4: { value: "Total" },
      },
    },
    expectedResult: [{ cell: "B4", value: 355, formula: "=SOMA(B1:B3)" }],
    hint: "Use a função SOMA com um intervalo.",
    level: "FUNDAMENTAL",
    difficulty: "VERY_EASY",
  },
  {
    id: "global-ex-media",
    title: "Média de notas",
    statement: "Em **B5**, calcule a média das notas de B1 a B4.",
    initialSheet: {
      cells: { B1: { value: 7 }, B2: { value: 8.5 }, B3: { value: 6 }, B4: { value: 9 } },
    },
    expectedResult: [{ cell: "B5", value: 7.625, formula: "=MÉDIA(B1:B4)", tolerance: 0.001 }],
    hint: "MÉDIA (ou AVERAGE) recebe um intervalo.",
    level: "FUNDAMENTAL",
    difficulty: "EASY",
  },
  {
    id: "global-ex-se",
    title: "Aprovado ou reprovado",
    statement: 'Em **C1**, mostre "Aprovado" se B1 for maior ou igual a 7; senão, "Reprovado".',
    initialSheet: { cells: { A1: { value: "Nota" }, B1: { value: 8 } } },
    expectedResult: [
      { cell: "C1", value: "Aprovado", formula: '=SE(B1>=7;"Aprovado";"Reprovado")' },
    ],
    hint: "SE(teste; valor_se_verdadeiro; valor_se_falso).",
    level: "FUNDAMENTAL",
    difficulty: "MEDIUM",
  },
  {
    id: "global-ex-procv",
    title: "Buscar preço com PROCV",
    statement:
      "Em **E1**, use PROCV para buscar o preço do produto informado em D1 na tabela A1:B3.",
    initialSheet: {
      cells: {
        A1: { value: "Caneta" },
        B1: { value: 2.5 },
        A2: { value: "Caderno" },
        B2: { value: 18 },
        A3: { value: "Lápis" },
        B3: { value: 1.2 },
        D1: { value: "Caderno" },
      },
    },
    expectedResult: [{ cell: "E1", value: 18, formula: "=PROCV(D1;A1:B3;2;FALSO)" }],
    hint: "O 4º argumento FALSO exige correspondência exata.",
    level: "PROFESSIONAL",
    difficulty: "MEDIUM",
  },
  {
    id: "global-ex-somases",
    title: "Somar por categoria (SOMASES)",
    statement: 'Em **E1**, some os valores da coluna B cuja categoria (coluna A) é "Alimentação".',
    initialSheet: {
      cells: {
        A1: { value: "Alimentação" },
        B1: { value: 50 },
        A2: { value: "Transporte" },
        B2: { value: 30 },
        A3: { value: "Alimentação" },
        B3: { value: 25 },
      },
    },
    expectedResult: [{ cell: "E1", value: 75, formula: '=SOMASES(B1:B3;A1:A3;"Alimentação")' }],
    hint: "SOMASES(intervalo_soma; intervalo_critério; critério).",
    level: "ADVANCED",
    difficulty: "HARD",
  },
];

function resolvePassword(user: SeedUser): string {
  const fromEnv = process.env[user.passwordEnv];
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Em produção defina ${user.passwordEnv}; senhas de dev não são usadas.`);
  }
  return user.devPassword;
}

async function seedUser(seed: SeedUser) {
  const user = await prisma.user.upsert({
    where: { email: seed.email },
    update: { name: seed.name, role: seed.role, tenantId: seed.tenantId, active: true },
    create: {
      email: seed.email,
      name: seed.name,
      role: seed.role,
      tenantId: seed.tenantId,
      emailVerified: true,
    },
  });

  // Credencial de dev no formato do Better Auth: providerId "credential", accountId = user.id.
  const password = await hashPassword(resolvePassword(seed));
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
    update: { password },
    create: { userId: user.id, accountId: user.id, providerId: "credential", password },
  });
  return user;
}

async function main() {
  const superAdminEmail = SEED_USERS[0]!.email;

  await prisma.tenant.upsert({
    where: { id: DEMO_TENANT.id },
    update: { name: DEMO_TENANT.name, emailDomains: DEMO_TENANT.emailDomains },
    create: DEMO_TENANT,
  });

  const users = new Map<string, { id: string }>();
  for (const seed of SEED_USERS) {
    const user = await seedUser(seed);
    users.set(seed.email, user);
    console.log(`  usuário  ${seed.role.padEnd(17)} ${seed.email}`);
  }
  const superAdminId = users.get(superAdminEmail)!.id;

  for (const exercise of GLOBAL_EXERCISES) {
    const data = {
      ...exercise,
      tenantId: null,
      isGlobal: true,
      status: "PUBLISHED" as const,
      authorId: superAdminId,
    };
    await prisma.exercise.upsert({ where: { id: exercise.id }, update: data, create: data });
  }
  console.log(`  exercícios globais: ${GLOBAL_EXERCISES.length}`);

  const section = {
    tenantId: null,
    isGlobal: true,
    title: "Introdução às fórmulas",
    slug: "introducao-as-formulas",
    body: "Toda fórmula começa com `=`. Ex.: `=SOMA(A1:A3)` soma as células A1, A2 e A3.",
    level: "FUNDAMENTAL" as const,
    status: "PUBLISHED" as const,
    publishedAt: new Date(),
    authorId: superAdminId,
  };
  await prisma.contentSection.upsert({
    where: { id: "global-sec-intro" },
    update: section,
    create: { id: "global-sec-intro", ...section },
  });

  // Trilha de exemplo da Escola Demo, usando o banco global.
  const professorId = users.get("professor@escola-demo.local")!.id;
  await prisma.exerciseSet.upsert({
    where: { id: "demo-set-trilha" },
    update: {},
    create: {
      id: "demo-set-trilha",
      tenantId: DEMO_TENANT.id,
      name: "Trilha Demo",
      difficulties: ["VERY_EASY", "EASY", "MEDIUM"],
      status: "PUBLISHED",
      publishedAt: new Date(),
      authorId: professorId,
    },
  });
  await prisma.level.upsert({
    where: { setId_knowledgeLevel: { setId: "demo-set-trilha", knowledgeLevel: "FUNDAMENTAL" } },
    update: {},
    create: {
      id: "demo-level-fundamental",
      tenantId: DEMO_TENANT.id,
      setId: "demo-set-trilha",
      knowledgeLevel: "FUNDAMENTAL",
    },
  });
  await prisma.exerciseQuota.upsert({
    where: { levelId_scopeKey: { levelId: "demo-level-fundamental", scopeKey: "default|*" } },
    update: {},
    create: {
      tenantId: DEMO_TENANT.id,
      levelId: "demo-level-fundamental",
      scopeKey: "default|*",
      quantity: 3,
    },
  });
  console.log("  trilha demo: 1 conjunto, nível Fundamental, cota padrão 3");
  console.log("Seed concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
