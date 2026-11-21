/**
 * Global setup da suíte e2e.
 *
 * 1. Cria (se não existir) o banco isolado `training_area_e2e` no mesmo servidor
 *    PostgreSQL do .env — o banco de dev compartilhado nunca é tocado nem apagado.
 * 2. Aplica as migrações com `prisma migrate deploy` nesse banco.
 * 3. Roda o seed próprio da suíte (e2e/seed.ts): instituições A/B, um Admin por
 *    instituição, professores, alunos e Super Admin — upsert, sem apagar nada.
 * 4. Sobe o provedor OAuth falso (Google/Microsoft) — encerrado no teardown.
 * 5. Garante arquivos de storage state vazios por papel, para os specs que
 *    dependem de login não quebrarem antes de o auth.setup gerar os reais.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { Client } from "pg";

import { seed } from "./seed";
import {
  E2E_DB_NAME,
  OAUTH_MOCK_ENABLED,
  OAUTH_MOCK_PORT,
  SKIP_DB,
  e2eDatabaseUrl,
} from "./support/env";
import { startMockOAuth } from "./support/mock-oauth";
import { SESSION_USERS, authFile, type SessionKey } from "./support/users";

async function ensureDatabase(url: string) {
  const admin = new URL(url);
  admin.pathname = "/postgres";
  admin.search = "";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      E2E_DB_NAME,
    ]);
    if (!rowCount) {
      // Identificador validado: só letras, números e _.
      if (!/^[a-z0-9_]+$/i.test(E2E_DB_NAME))
        throw new Error(`E2E_DB_NAME inválido: ${E2E_DB_NAME}`);
      await client.query(`CREATE DATABASE "${E2E_DB_NAME}"`);
      console.log(`[e2e] banco ${E2E_DB_NAME} criado`);
    }
  } finally {
    await client.end();
  }
}

function migrate(url: string) {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}

async function seedDatabase(url: string) {
  const client = new Client({ connectionString: url.replace(/\?schema=public$/, "") });
  await client.connect();
  try {
    const report = await seed(client);
    console.log(
      `[e2e] seed: ${report.users} usuários; pendente: ${report.pending.join("; ") || "nada"}`,
    );
  } finally {
    await client.end();
  }
}

function ensureEmptyStorageStates() {
  for (const key of Object.keys(SESSION_USERS) as SessionKey[]) {
    const file = authFile(key);
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file)) writeFileSync(file, JSON.stringify({ cookies: [], origins: [] }));
  }
}

export default async function globalSetup() {
  ensureEmptyStorageStates();
  let stopOAuth: (() => Promise<void>) | undefined;
  if (OAUTH_MOCK_ENABLED) {
    const server = await startMockOAuth(OAUTH_MOCK_PORT);
    console.log(`[e2e] mock OAuth (Google/Microsoft) em http://localhost:${OAUTH_MOCK_PORT}`);
    stopOAuth = () => new Promise((resolve) => server.close(() => resolve()));
  }
  if (SKIP_DB) {
    console.log("[e2e] E2E_SKIP_DB/E2E_BASE_URL definido: provisionamento do banco ignorado");
    return stopOAuth;
  }
  const url = e2eDatabaseUrl();
  if (!url) throw new Error("[e2e] defina DATABASE_URL (ou E2E_DATABASE_URL) no .env");
  await ensureDatabase(url);
  migrate(url);
  await seedDatabase(url);
  console.log(`[e2e] banco ${E2E_DB_NAME} pronto`);
  return stopOAuth;
}
