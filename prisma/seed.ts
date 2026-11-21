import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient, type Prisma, type Role } from "../src/generated/prisma/client";
import { levelPoolWhere } from "../src/lib/pool";
import { snapshotFromExercise } from "../src/lib/set-exercises";
import { exerciseInputSchema } from "../src/lib/validation/content";
import { toExerciseData } from "../src/server/content/exercise-data";
import { GLOBAL_EXERCISES } from "./seed-data";

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
  // Entrada automática por domínio é opcional e DESLIGADA por padrão (PO/MVP):
  // o domínio fica cadastrado, mas só entra quem tiver convite.
  autoJoinByDomain: false,
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
    update: {
      name: DEMO_TENANT.name,
      emailDomains: DEMO_TENANT.emailDomains,
      autoJoinByDomain: DEMO_TENANT.autoJoinByDomain,
    },
    create: DEMO_TENANT,
  });

  // Padrão da plataforma (linha única; a migração já cria — aqui só garante).
  await prisma.platformGradingDefaults.upsert({
    where: { id: "platform" },
    update: {},
    create: { id: "platform", edMinPercent: 50, dMinPercent: 70, pdMinPercent: 90 },
  });

  // Cópia das faixas padrão para a instituição demo (como createTenant faz).
  await prisma.tenantGradingConfig.upsert({
    where: { tenantId: DEMO_TENANT.id },
    update: {},
    create: { tenantId: DEMO_TENANT.id, edMinPercent: 50, dMinPercent: 70, pdMinPercent: 90 },
  });

  const users = new Map<string, { id: string }>();
  for (const seed of SEED_USERS) {
    const user = await seedUser(seed);
    users.set(seed.email, user);
    console.log(`  usuário  ${seed.role.padEnd(17)} ${seed.email}`);
  }
  const superAdminId = users.get(superAdminEmail)!.id;

  for (const { id, ...exercise } of GLOBAL_EXERCISES) {
    const data = {
      id,
      ...toExerciseData(exerciseInputSchema.parse(exercise)),
      tenantId: null,
      isGlobal: true,
      status: "PUBLISHED" as const,
      authorId: superAdminId,
    } as Prisma.ExerciseUncheckedCreateInput;
    await prisma.exercise.upsert({ where: { id }, update: data, create: data });
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
  // Cota padrão por dificuldade (total do nível = soma): 2 muito fáceis, 1 fácil, 1 média.
  const demoQuotas = { VERY_EASY: 2, EASY: 1, MEDIUM: 1 } as const;
  for (const [difficulty, quantity] of Object.entries(demoQuotas) as [
    keyof typeof demoQuotas,
    number,
  ][]) {
    const scopeKey = `default|${difficulty}`;
    await prisma.exerciseQuota.upsert({
      where: { levelId_scopeKey: { levelId: "demo-level-fundamental", scopeKey } },
      update: {},
      create: {
        tenantId: DEMO_TENANT.id,
        levelId: "demo-level-fundamental",
        difficulty,
        scopeKey,
        quantity,
      },
    });
  }
  // Pool do conjunto = exercícios VINCULADOS (SetPoolExercise): liga os globais elegíveis.
  const pool = await prisma.exercise.findMany({
    where: {
      OR: [{ tenantId: DEMO_TENANT.id }, { tenantId: null }],
      ...levelPoolWhere("FUNDAMENTAL", ["VERY_EASY", "EASY", "MEDIUM"]),
    },
    orderBy: [{ difficulty: "asc" }, { title: "asc" }, { id: "asc" }],
  });
  await prisma.setPoolExercise.createMany({
    data: pool.map((e) => ({
      tenantId: DEMO_TENANT.id,
      setId: "demo-set-trilha",
      exerciseId: e.id,
    })),
    skipDuplicates: true,
  });
  // Conjunto publicado sorteia só de SetExercise da versão atual: congela a versão 1
  // com os vinculados (mesma regra de publishSet).
  const snapshots = await prisma.setExercise.count({ where: { setId: "demo-set-trilha" } });
  if (snapshots === 0) {
    await prisma.setExercise.createMany({
      data: pool.map((e, position) => ({
        tenantId: DEMO_TENANT.id,
        setId: "demo-set-trilha",
        version: 1,
        levelId: "demo-level-fundamental",
        sourceExerciseId: e.id,
        position,
        level: e.level,
        difficulty: e.difficulty,
        snapshot: snapshotFromExercise(e) as unknown as Prisma.InputJsonValue,
      })),
    });
    await prisma.exerciseSet.update({
      where: { id: "demo-set-trilha" },
      data: { publishedVersion: 1 },
    });
  }
  console.log(
    `  trilha demo: 1 conjunto publicado (v1), ${pool.length} exercícios vinculados, cota 2+1+1 por dificuldade`,
  );
  console.log("Seed concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
