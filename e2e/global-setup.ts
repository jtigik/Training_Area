/**
 * Global setup da suíte e2e.
 *
 * 1. Cria (se não existir) o banco isolado `training_area_e2e` no mesmo servidor
 *    PostgreSQL do .env — o banco de dev compartilhado nunca é tocado nem apagado.
 * 2. Aplica as migrações com `prisma migrate deploy` nesse banco.
 * 3. Faz upsert dos usuários de teste (prefixo `e2e.`), sem apagar nada.
 * 4. Garante arquivos de storage state vazios por papel, para os specs que
 *    dependem de login não quebrarem antes de o auth.setup gerar os reais.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { Client } from "pg";

import { E2E_DB_NAME, SKIP_DB, e2eDatabaseUrl } from "./support/env";
import { OTHER_STUDENT, USERS, authFile, type RoleKey } from "./support/users";

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

async function seedUsers(url: string) {
  const client = new Client({ connectionString: url.replace(/\?schema=public$/, "") });
  await client.connect();
  try {
    for (const user of [...Object.values(USERS), OTHER_STUDENT]) {
      // TODO(TA-001): quando o hash de senha existir (ex.: src/server/auth/password.ts),
      // gravar password_hash = hash(E2E_PASSWORD) aqui para o login por UI funcionar.
      await client.query(
        `INSERT INTO users (id, email, name, role, active, updated_at)
         VALUES ($1, $2, $3, $4::"Role", true, now())
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role,
           active = true, updated_at = now()`,
        [user.id, user.email, user.name, user.role],
      );
    }
  } finally {
    await client.end();
  }
}

function ensureEmptyStorageStates() {
  for (const key of ["aluno", "professor", "admin"] as RoleKey[]) {
    const file = authFile(key);
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file)) writeFileSync(file, JSON.stringify({ cookies: [], origins: [] }));
  }
}

export default async function globalSetup() {
  ensureEmptyStorageStates();
  if (SKIP_DB) {
    console.log("[e2e] E2E_SKIP_DB/E2E_BASE_URL definido: provisionamento do banco ignorado");
    return;
  }
  const url = e2eDatabaseUrl();
  if (!url) throw new Error("[e2e] defina DATABASE_URL (ou E2E_DATABASE_URL) no .env");
  await ensureDatabase(url);
  migrate(url);
  await seedUsers(url);
  console.log(`[e2e] banco ${E2E_DB_NAME} pronto com usuários de teste`);
}
