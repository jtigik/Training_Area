/**
 * Leitura das variáveis de autenticação (sem efeitos colaterais; testável).
 *
 * - BETTER_AUTH_SECRET, BETTER_AUTH_URL: lidas pelo próprio Better Auth.
 * - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET: login Google (lançamento).
 * - MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET / MICROSOFT_TENANT_ID: login
 *   Microsoft (Entra ID; tenant padrão "common").
 * - AUTH_EMAIL_PASSWORD_ENABLED=true: liga e-mail+senha SÓ para dev/teste
 *   (seed e E2E). Desligado por padrão e sempre desligado em produção.
 * - AUTH_OAUTH_MOCK_BASE_URL: SÓ dev/teste (E2E). Troca os provedores nativos
 *   Google/Microsoft por provedores genéricos (plugin genericOAuth) com os mesmos
 *   ids, apontando para um servidor OAuth falso. Ignorada em produção.
 * - AUTH_TEST_MODE=1: libera as duas opções acima num BUILD de produção
 *   (NODE_ENV=production), para o E2E da CI rodar `npm run start`. Nunca em
 *   deploy real: validateServerEnv (src/lib/env.ts) falha no boot se
 *   APP_ENV=production (ou DEPLOY_ENV=production) e AUTH_TEST_MODE=1.
 */
export const LOGIN_PROVIDER_IDS = ["google", "microsoft"] as const;
export type LoginProviderId = (typeof LOGIN_PROVIDER_IDS)[number];

export interface SocialProviderConfig {
  clientId: string;
  clientSecret: string;
}

export interface MockOAuthProviderConfig extends SocialProviderConfig {
  providerId: LoginProviderId;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

export interface AuthEnvConfig {
  emailPasswordEnabled: boolean;
  /** "native": socialProviders do Better Auth; "mock": genericOAuth no servidor falso. */
  oauthMode: "native" | "mock";
  google: SocialProviderConfig | null;
  microsoft: (SocialProviderConfig & { tenantId: string }) | null;
  /** Preenchido só no modo "mock". */
  mockProviders: MockOAuthProviderConfig[];
}

type Env = Record<string, string | undefined>;

/** Recursos de teste (e-mail+senha, OAuth falso) liberados? Fora de produção, sim; em produção só com AUTH_TEST_MODE=1. */
export function testAuthFeaturesAllowed(env: Env): boolean {
  return env.NODE_ENV !== "production" || env.AUTH_TEST_MODE?.trim() === "1";
}

const ENV_KEYS: Record<LoginProviderId, { id: string; secret: string }> = {
  google: { id: "GOOGLE_CLIENT_ID", secret: "GOOGLE_CLIENT_SECRET" },
  microsoft: { id: "MICROSOFT_CLIENT_ID", secret: "MICROSOFT_CLIENT_SECRET" },
};

function pair(env: Env, provider: LoginProviderId): SocialProviderConfig | null {
  const clientId = env[ENV_KEYS[provider].id]?.trim();
  const clientSecret = env[ENV_KEYS[provider].secret]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** URL base do mock, sem barra final; null se ausente, inválida ou em produção sem AUTH_TEST_MODE=1. */
export function readMockBaseUrl(env: Env): string | null {
  if (!testAuthFeaturesAllowed(env)) return null;
  const raw = env.AUTH_OAUTH_MOCK_BASE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function buildMockProviders(baseUrl: string, env: Env): MockOAuthProviderConfig[] {
  return LOGIN_PROVIDER_IDS.map((providerId) => {
    // No mock qualquer valor serve; usa as mesmas variáveis do modo nativo.
    const creds = pair(env, providerId) ?? {
      clientId: `mock-${providerId}-client`,
      clientSecret: `mock-${providerId}-secret`,
    };
    return {
      providerId,
      ...creds,
      authorizationUrl: `${baseUrl}/${providerId}/authorize`,
      tokenUrl: `${baseUrl}/${providerId}/token`,
      userInfoUrl: `${baseUrl}/${providerId}/userinfo`,
    };
  });
}

export function readAuthEnv(env: Env = process.env): AuthEnvConfig {
  const emailPasswordEnabled =
    testAuthFeaturesAllowed(env) && env.AUTH_EMAIL_PASSWORD_ENABLED === "true";
  const mockBaseUrl = readMockBaseUrl(env);

  if (mockBaseUrl) {
    return {
      emailPasswordEnabled,
      oauthMode: "mock",
      google: null,
      microsoft: null,
      mockProviders: buildMockProviders(mockBaseUrl, env),
    };
  }

  const microsoft = pair(env, "microsoft");
  return {
    emailPasswordEnabled,
    oauthMode: "native",
    google: pair(env, "google"),
    microsoft: microsoft
      ? { ...microsoft, tenantId: env.MICROSOFT_TENANT_ID?.trim() || "common" }
      : null,
    mockProviders: [],
  };
}

export interface LoginOptions {
  /** Provedores com botão na tela de login. Use authClient.signIn.social({ provider }). */
  providers: { id: LoginProviderId; label: string }[];
  /** Mostrar formulário de e-mail+senha (só dev/teste). */
  emailPassword: boolean;
  oauthMode: AuthEnvConfig["oauthMode"];
}

const PROVIDER_LABELS: Record<LoginProviderId, string> = {
  google: "Google",
  microsoft: "Microsoft",
};

/** Opções públicas de login, para a UI (sem segredos). */
export function loginOptionsFrom(config: AuthEnvConfig): LoginOptions {
  const enabled: LoginProviderId[] =
    config.oauthMode === "mock"
      ? config.mockProviders.map((p) => p.providerId)
      : LOGIN_PROVIDER_IDS.filter((id) => config[id] !== null);
  return {
    providers: enabled.map((id) => ({ id, label: PROVIDER_LABELS[id] })),
    emailPassword: config.emailPasswordEnabled,
    oauthMode: config.oauthMode,
  };
}
