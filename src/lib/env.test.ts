import { afterEach, describe, expect, it, vi } from "vitest";

import { EnvValidationError, requireEnv, validateServerEnv } from "./env";

describe("requireEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("retorna o valor quando definido", () => {
    vi.stubEnv("TA_TEST_VAR", "abc");
    expect(requireEnv("TA_TEST_VAR")).toBe("abc");
  });

  it("lança erro quando ausente", () => {
    vi.stubEnv("TA_TEST_VAR", "");
    expect(() => requireEnv("TA_TEST_VAR")).toThrow(/TA_TEST_VAR/);
  });
});

describe("validateServerEnv", () => {
  it("aceita ambiente vazio em dev/teste com padrões seguros", () => {
    const env = validateServerEnv({ NODE_ENV: "test" });
    expect(env.ai.provider).toBe("disabled");
    expect(env.auth.google).toBeUndefined();
    expect(env.auth.microsoft).toBeUndefined();
    expect(env.tenancy).toEqual({
      resolution: "single",
      defaultSlug: "default",
      rootDomain: undefined,
    });
  });

  const STRONG = "k3Jv9qLmZ2xR8tYwB5nC1dF6gH0sA4eP7uQ"; // 35 caracteres, fictício

  it("exige BETTER_AUTH_SECRET em produção (AUTH_SECRET como alternativa)", () => {
    expect(() => validateServerEnv({ NODE_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET/);
    expect(
      validateServerEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: STRONG }).auth.secret,
    ).toBe(STRONG);
    expect(validateServerEnv({ NODE_ENV: "production", AUTH_SECRET: STRONG }).auth.secret).toBe(
      STRONG,
    );
  });

  it("em produção recusa placeholder e segredo com menos de 32 caracteres", () => {
    for (const secret of [
      "troque-por-um-segredo-aleatorio-de-32-caracteres",
      "TROQUE_ISTO_0123456789012345678901234",
      "changeme-changeme-changeme-changeme",
      "placeholder-0123456789-0123456789-01",
    ]) {
      expect(() =>
        validateServerEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: secret }),
      ).toThrow(/placeholder/);
    }
    expect(() =>
      validateServerEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: "a".repeat(10) + "Z9" }),
    ).toThrow(/pelo menos 32/);
    expect(() =>
      validateServerEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: STRONG.slice(0, 31) }),
    ).toThrow(/pelo menos 32/);
    // fora de produção o segredo de dev segue aceito
    expect(validateServerEnv({ BETTER_AUTH_SECRET: "dev" }).auth.secret).toBe("dev");
  });

  it("AUTH_TEST_MODE=1 falha no boot de deploy real (APP_ENV/DEPLOY_ENV=production)", () => {
    for (const marker of [{ APP_ENV: "production" }, { DEPLOY_ENV: "Production" }]) {
      expect(() =>
        validateServerEnv({
          NODE_ENV: "production",
          BETTER_AUTH_SECRET: STRONG,
          AUTH_TEST_MODE: "1",
          ...marker,
        }),
      ).toThrow(/AUTH_TEST_MODE=1 é proibido em deploy real/);
    }
    // build de produção da CI/E2E (sem marcador de deploy): permitido, sem aviso
    const ci = validateServerEnv({
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: STRONG,
      AUTH_TEST_MODE: "1",
      AUTH_EMAIL_PASSWORD_ENABLED: "true",
      AUTH_OAUTH_MOCK_BASE_URL: "http://127.0.0.1:4010",
    });
    expect(ci).toMatchObject({ authTestMode: true, isDeploy: false, warnings: [] });
  });

  it("avisa quando variáveis de teste estão em produção sem AUTH_TEST_MODE", () => {
    const env = validateServerEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      BETTER_AUTH_SECRET: STRONG,
      AUTH_EMAIL_PASSWORD_ENABLED: "true",
      AUTH_OAUTH_MOCK_BASE_URL: "http://mock",
    });
    expect(env.warnings).toHaveLength(1);
    expect(env.warnings[0]).toMatch(/AUTH_EMAIL_PASSWORD_ENABLED=true e AUTH_OAUTH_MOCK_BASE_URL/);
    expect(
      validateServerEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: STRONG }).warnings,
    ).toEqual([]);
    expect(validateServerEnv({ AUTH_EMAIL_PASSWORD_ENABLED: "true" }).warnings).toEqual([]);
  });

  it("exige id e secret do OAuth em par", () => {
    expect(() => validateServerEnv({ GOOGLE_CLIENT_ID: "id" })).toThrow(/GOOGLE_CLIENT_SECRET/);
    const env = validateServerEnv({ MICROSOFT_CLIENT_ID: "id", MICROSOFT_CLIENT_SECRET: "s" });
    expect(env.auth.microsoft).toEqual({ id: "id", secret: "s", tenantId: "common" });
    expect(
      validateServerEnv({
        MICROSOFT_CLIENT_ID: "id",
        MICROSOFT_CLIENT_SECRET: "s",
        MICROSOFT_TENANT_ID: "org",
      }).auth.microsoft?.tenantId,
    ).toBe("org");
  });

  it("AI_PROVIDER: disabled | mock | openai-compatible", () => {
    expect(validateServerEnv({}).ai.provider).toBe("disabled");
    expect(() => validateServerEnv({ AI_TIMEOUT_MS: "0" })).toThrow(/AI_TIMEOUT_MS/);
    expect(validateServerEnv({ AI_PROVIDER: "disabled" }).ai.provider).toBe("disabled");
    // mock/disabled não exigem chave nem URL
    expect(validateServerEnv({ AI_PROVIDER: "mock" }).ai.apiKey).toBeUndefined();
    for (const old of ["openai", "anthropic", "foo"]) {
      expect(() => validateServerEnv({ AI_PROVIDER: old })).toThrow(EnvValidationError);
    }
  });

  it("openai-compatible exige AI_API_KEY e AI_BASE_URL http(s)", () => {
    expect(() => validateServerEnv({ AI_PROVIDER: "openai-compatible" })).toThrow(/AI_API_KEY/);
    expect(() => validateServerEnv({ AI_PROVIDER: "openai-compatible" })).toThrow(/AI_BASE_URL/);
    expect(() =>
      validateServerEnv({ AI_PROVIDER: "openai-compatible", AI_API_KEY: "k", AI_BASE_URL: "x" }),
    ).toThrow(/URL http/);
    const env = validateServerEnv({
      AI_PROVIDER: "openai-compatible",
      AI_API_KEY: "k",
      AI_BASE_URL: "https://llm.example/v1",
      AI_MODEL: "m",
    });
    expect(env.ai).toEqual({
      provider: "openai-compatible",
      apiKey: "k",
      baseUrl: "https://llm.example/v1",
      model: "m",
    });
  });

  it("valida a configuração de tenancy", () => {
    expect(() => validateServerEnv({ TENANT_RESOLUTION: "subdomain" })).toThrow(/APP_ROOT_DOMAIN/);
    expect(() => validateServerEnv({ DEFAULT_TENANT_SLUG: "Escola X" })).toThrow(
      /DEFAULT_TENANT_SLUG/,
    );
    const env = validateServerEnv({
      TENANT_RESOLUTION: "subdomain",
      APP_ROOT_DOMAIN: "training.example.com",
      DEFAULT_TENANT_SLUG: "escola-x",
    });
    expect(env.tenancy.rootDomain).toBe("training.example.com");
  });
});
