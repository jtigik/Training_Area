/**
 * Leitura e validação das variáveis de ambiente do servidor.
 *
 * Regra geral: tudo que é integração externa (OAuth, IA) é opcional em
 * desenvolvimento e teste, para que `npm run dev`, `npm test` e o build da CI
 * funcionem sem credenciais reais. Em produção, `validateServerEnv` exige o
 * mínimo para o app subir com segurança. A lista completa está no README
 * ("Variáveis de ambiente") e em `.env.example`.
 */

/**
 * `disabled` (padrão, igual a src/server/ai/factory): sem IA, feedback por regras/templates;
 * `mock`: texto fixo local (usado no .env.example e na CI);
 * `openai-compatible`: qualquer API no formato OpenAI (`AI_BASE_URL` + `AI_API_KEY`).
 */
export const AI_PROVIDERS = ["disabled", "mock", "openai-compatible"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const TENANT_RESOLUTION_MODES = ["single", "path", "subdomain"] as const;
export type TenantResolution = (typeof TENANT_RESOLUTION_MODES)[number];

type Source = Record<string, string | undefined>;

export interface OAuthProviderEnv {
  id: string;
  secret: string;
}

export interface ServerEnv {
  nodeEnv: string;
  /** Deploy real (APP_ENV=production ou DEPLOY_ENV=production); distinto do build NODE_ENV. */
  isDeploy: boolean;
  /** AUTH_TEST_MODE=1 (só CI/E2E com build de produção). */
  authTestMode: boolean;
  /** Avisos não fatais (logados no boot por src/instrumentation.ts). */
  warnings: string[];
  databaseUrl: string | undefined;
  auth: {
    secret: string | undefined;
    url: string | undefined;
    google: OAuthProviderEnv | undefined;
    microsoft: (OAuthProviderEnv & { tenantId: string }) | undefined;
    /** Provedor OAuth falso para E2E (ignorado em produção pelo auth). */
    oauthMockBaseUrl: string | undefined;
  };
  ai: {
    provider: AiProvider;
    apiKey: string | undefined;
    /** Base da API compatível com OpenAI (ex.: https://api.openai.com/v1). */
    baseUrl: string | undefined;
    model: string | undefined;
  };
  tenancy: {
    resolution: TenantResolution;
    defaultSlug: string;
    rootDomain: string | undefined;
  };
}

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Configuração de ambiente inválida:\n- ${issues.join("\n- ")}`);
    this.name = "EnvValidationError";
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function read(source: Source, name: string): string | undefined {
  const value = source[name]?.trim();
  return value ? value : undefined;
}

function oneOf<T extends string>(
  source: Source,
  name: string,
  allowed: readonly T[],
  fallback: T,
  issues: string[],
): T {
  const value = read(source, name);
  if (value === undefined) return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  issues.push(`${name} deve ser um de: ${allowed.join(", ")} (recebido: "${value}")`);
  return fallback;
}

function oauthPair(
  source: Source,
  idName: string,
  secretName: string,
  issues: string[],
): OAuthProviderEnv | undefined {
  const id = read(source, idName);
  const secret = read(source, secretName);
  if (!id && !secret) return undefined;
  if (!id || !secret) {
    issues.push(`${idName} e ${secretName} devem ser definidas juntas`);
    return undefined;
  }
  return { id, secret };
}

/** Marcador de deploy real: APP_ENV=production ou DEPLOY_ENV=production. */
export function isRealDeploy(source: Source = process.env): boolean {
  return [read(source, "APP_ENV"), read(source, "DEPLOY_ENV")].some(
    (v) => v?.toLowerCase() === "production",
  );
}

export const MIN_AUTH_SECRET_LENGTH = 32;
/** Valores de exemplo que não podem ir para produção (ex.: o antigo placeholder do .env.example). */
const SECRET_PLACEHOLDER =
  /troque|change[-_ ]?me|placeholder|exemplo|example|your[-_]?secret|seu[-_]?segredo|^x+$/i;

/** Problema do segredo em produção, ou null se ok. */
export function authSecretIssue(secret: string | undefined): string | null {
  if (!secret)
    return "BETTER_AUTH_SECRET é obrigatória em produção (gere com `openssl rand -base64 32`)";
  if (SECRET_PLACEHOLDER.test(secret)) {
    return "BETTER_AUTH_SECRET parece um placeholder (ex.: 'troque-…'); gere um segredo próprio com `openssl rand -base64 32`";
  }
  if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    return `BETTER_AUTH_SECRET deve ter pelo menos ${MIN_AUTH_SECRET_LENGTH} caracteres em produção`;
  }
  return null;
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Lê e valida as variáveis do servidor. Lança `EnvValidationError` se algo for inválido. */
export function validateServerEnv(source: Source = process.env): ServerEnv {
  const issues: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = read(source, "NODE_ENV") ?? "development";
  const isProduction = nodeEnv === "production";
  const isDeploy = isRealDeploy(source);
  const authTestMode = read(source, "AUTH_TEST_MODE") === "1";

  // Modo de teste de autenticação (e-mail+senha e OAuth falso num build de produção).
  // AUTH_TEST_MODE=1 é SÓ para CI/E2E; num deploy real o boot falha.
  if (authTestMode && isDeploy) {
    issues.push(
      "AUTH_TEST_MODE=1 é proibido em deploy real (APP_ENV/DEPLOY_ENV=production): liberaria login por senha e OAuth falso",
    );
  }
  const testVars = [
    read(source, "AUTH_EMAIL_PASSWORD_ENABLED") === "true" && "AUTH_EMAIL_PASSWORD_ENABLED=true",
    read(source, "AUTH_OAUTH_MOCK_BASE_URL") && "AUTH_OAUTH_MOCK_BASE_URL",
  ].filter((v): v is string => Boolean(v));
  if (isProduction && !authTestMode && testVars.length > 0) {
    warnings.push(
      `${testVars.join(" e ")} definida(s) em produção sem AUTH_TEST_MODE=1: ignorada(s). Remova do ambiente de deploy.`,
    );
  }

  // Better Auth (OAuth Google / Microsoft). Mesmos nomes lidos por src/server/auth.
  // AUTH_SECRET é aceito como alternativa, como o próprio Better Auth faz.
  const authSecret = read(source, "BETTER_AUTH_SECRET") ?? read(source, "AUTH_SECRET");
  if (isProduction || isDeploy) {
    const secretIssue = authSecretIssue(authSecret);
    if (secretIssue) issues.push(secretIssue);
  }
  const google = oauthPair(source, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", issues);
  const microsoft = oauthPair(source, "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", issues);
  const microsoftTenantId = read(source, "MICROSOFT_TENANT_ID") ?? "common";

  // Provedor de IA para feedback
  const aiProvider = oneOf(source, "AI_PROVIDER", AI_PROVIDERS, "disabled", issues);
  const aiApiKey = read(source, "AI_API_KEY");
  const aiBaseUrl = read(source, "AI_BASE_URL");
  const aiTimeout = read(source, "AI_TIMEOUT_MS");
  if (aiTimeout !== undefined && !(Number(aiTimeout) > 0)) {
    issues.push("AI_TIMEOUT_MS deve ser um número positivo (ms)");
  }
  if (aiProvider === "openai-compatible") {
    if (!aiApiKey) issues.push("AI_API_KEY é obrigatória quando AI_PROVIDER=openai-compatible");
    if (!aiBaseUrl) {
      issues.push("AI_BASE_URL é obrigatória quando AI_PROVIDER=openai-compatible");
    } else if (!/^https?:\/\/\S+$/.test(aiBaseUrl)) {
      issues.push("AI_BASE_URL deve ser uma URL http(s)");
    }
  }

  // Multi-tenant
  const resolution = oneOf(source, "TENANT_RESOLUTION", TENANT_RESOLUTION_MODES, "single", issues);
  const defaultSlug = read(source, "DEFAULT_TENANT_SLUG") ?? "default";
  if (!SLUG_PATTERN.test(defaultSlug)) {
    issues.push("DEFAULT_TENANT_SLUG deve conter só letras minúsculas, números e hífens");
  }
  const rootDomain = read(source, "APP_ROOT_DOMAIN");
  if (resolution === "subdomain" && !rootDomain) {
    issues.push("APP_ROOT_DOMAIN é obrigatória quando TENANT_RESOLUTION=subdomain");
  }

  if (issues.length > 0) throw new EnvValidationError(issues);

  return {
    nodeEnv,
    isDeploy,
    authTestMode,
    warnings,
    databaseUrl: read(source, "DATABASE_URL"),
    auth: {
      secret: authSecret,
      url: read(source, "BETTER_AUTH_URL"),
      google,
      microsoft: microsoft ? { ...microsoft, tenantId: microsoftTenantId } : undefined,
      oauthMockBaseUrl: read(source, "AUTH_OAUTH_MOCK_BASE_URL"),
    },
    ai: {
      provider: aiProvider,
      apiKey: aiApiKey,
      baseUrl: aiBaseUrl,
      model: read(source, "AI_MODEL"),
    },
    tenancy: { resolution, defaultSlug, rootDomain },
  };
}
