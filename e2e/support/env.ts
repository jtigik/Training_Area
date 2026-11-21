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

/**
 * Login por e-mail+senha é só de dev/teste (Backend 1), DESLIGADO por padrão no app.
 * A suíte o liga no webServer para o auth.setup; `E2E_PASSWORD_LOGIN=0` sobe o app com
 * ele desligado (usado pelo teste "login por senha desligado").
 * O nome da variável do app é configurável até o Backend 1 fixar o nome.
 */
export const PASSWORD_LOGIN_ENABLED = process.env.E2E_PASSWORD_LOGIN !== "0";
export const PASSWORD_LOGIN_APP_FLAG = process.env.E2E_PASSWORD_FLAG_VAR ?? "AUTH_PASSWORD_LOGIN";

/** Provedor OAuth/OIDC falso (Google e Microsoft) servido pela própria suíte. */
export const OAUTH_MOCK_PORT = Number(process.env.E2E_OAUTH_PORT ?? 3199);
export const OAUTH_MOCK_URL = `http://localhost:${OAUTH_MOCK_PORT}`;
export const OAUTH_MOCK_ENABLED = process.env.E2E_OAUTH_MOCK !== "0" && !process.env.E2E_BASE_URL;

/**
 * Variáveis passadas ao app em teste. Contrato proposto ao Backend 1 (ver e2e/README.md):
 * o app deve aceitar issuer/endpoints configuráveis para Google e Microsoft.
 */
export function appTestEnv(): Record<string, string> {
  const env: Record<string, string> = {
    [PASSWORD_LOGIN_APP_FLAG]: PASSWORD_LOGIN_ENABLED ? "true" : "false",
  };
  if (OAUTH_MOCK_ENABLED) {
    Object.assign(env, {
      AUTH_GOOGLE_ISSUER: `${OAUTH_MOCK_URL}/google`,
      AUTH_GOOGLE_ID: "e2e-google-client",
      AUTH_GOOGLE_SECRET: "e2e-google-secret",
      AUTH_MICROSOFT_ENTRA_ID_ISSUER: `${OAUTH_MOCK_URL}/microsoft`,
      AUTH_MICROSOFT_ENTRA_ID_ID: "e2e-microsoft-client",
      AUTH_MICROSOFT_ENTRA_ID_SECRET: "e2e-microsoft-secret",
    });
  }
  return env;
}
