/**
 * Configuração compartilhada da suíte e2e.
 *
 * Isolamento de dados: a suíte NUNCA usa o banco de desenvolvimento compartilhado
 * (`training_area`). Ela usa um banco próprio no mesmo servidor PostgreSQL
 * (padrão: `training_area_e2e`), criado e migrado pelo global-setup.
 * Todos os registros criados pelos testes usam o prefixo `E2E_PREFIX`.
 */
import "dotenv/config";

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${E2E_PORT}`;

/** Prefixo dos dados criados pela suíte (e-mails, títulos, nomes de conjunto). */
export const E2E_PREFIX = "e2e";

/** Nome do banco isolado usado pela suíte. */
export const E2E_DB_NAME = process.env.E2E_DB_NAME ?? "training_area_e2e";

/**
 * URL do banco da suíte. Ordem: E2E_DATABASE_URL explícita → DATABASE_URL do .env
 * com o nome do banco trocado por E2E_DB_NAME.
 */
export function e2eDatabaseUrl(): string | undefined {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  const url = new URL(base);
  url.pathname = `/${E2E_DB_NAME}`;
  return url.toString();
}

/** `E2E_SKIP_DB=1` pula o provisionamento do banco (ex.: testando um servidor remoto). */
export const SKIP_DB = process.env.E2E_SKIP_DB === "1" || !!process.env.E2E_BASE_URL;
