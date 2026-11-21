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
 * `disabled`: sem IA (feedback só manual); `mock`: texto fixo local (padrão em dev e CI);
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

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Lê e valida as variáveis do servidor. Lança `EnvValidationError` se algo for inválido. */
export function validateServerEnv(source: Source = process.env): ServerEnv {
  const issues: string[] = [];
  const nodeEnv = read(source, "NODE_ENV") ?? "development";
  const isProduction = nodeEnv === "production";

  // Better Auth (OAuth Google / Microsoft). Mesmos nomes lidos por src/server/auth.
  // AUTH_SECRET é aceito como alternativa, como o próprio Better Auth faz.
  const authSecret = read(source, "BETTER_AUTH_SECRET") ?? read(source, "AUTH_SECRET");
  if (isProduction && !authSecret) {
    issues.push(
      "BETTER_AUTH_SECRET é obrigatória em produção (gere com `openssl rand -base64 32`)",
    );
  }
  const google = oauthPair(source, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", issues);
  const microsoft = oauthPair(source, "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", issues);
  const microsoftTenantId = read(source, "MICROSOFT_TENANT_ID") ?? "common";

  // Provedor de IA para feedback
  const aiProvider = oneOf(source, "AI_PROVIDER", AI_PROVIDERS, "mock", issues);
  const aiApiKey = read(source, "AI_API_KEY");
  const aiBaseUrl = read(source, "AI_BASE_URL");
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
