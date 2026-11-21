/**
 * Leitura das variáveis de autenticação (sem efeitos colaterais; testável).
 *
 * - BETTER_AUTH_SECRET, BETTER_AUTH_URL: lidas pelo próprio Better Auth.
 * - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET: login Google (lançamento).
 * - MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET / MICROSOFT_TENANT_ID: login
 *   Microsoft (Entra ID; tenant padrão "common").
 * - AUTH_EMAIL_PASSWORD_ENABLED=true: liga e-mail+senha SÓ para dev/teste
 *   (seed e E2E). Desligado por padrão e sempre desligado em produção.
 */
export interface SocialProviderConfig {
  clientId: string;
  clientSecret: string;
}

export interface AuthEnvConfig {
  emailPasswordEnabled: boolean;
  google: SocialProviderConfig | null;
  microsoft: (SocialProviderConfig & { tenantId: string }) | null;
}

type Env = Record<string, string | undefined>;

function pair(env: Env, idKey: string, secretKey: string): SocialProviderConfig | null {
  const clientId = env[idKey]?.trim();
  const clientSecret = env[secretKey]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function readAuthEnv(env: Env = process.env): AuthEnvConfig {
  const isProduction = env.NODE_ENV === "production";
  const microsoft = pair(env, "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET");
  return {
    emailPasswordEnabled: !isProduction && env.AUTH_EMAIL_PASSWORD_ENABLED === "true",
    google: pair(env, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
    microsoft: microsoft
      ? { ...microsoft, tenantId: env.MICROSOFT_TENANT_ID?.trim() || "common" }
      : null,
  };
}
