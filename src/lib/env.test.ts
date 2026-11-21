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
    expect(env.ai.provider).toBe("mock");
    expect(env.auth.google).toBeUndefined();
    expect(env.auth.microsoft).toBeUndefined();
    expect(env.tenancy).toEqual({
      resolution: "single",
      defaultSlug: "default",
      rootDomain: undefined,
    });
  });

  it("exige BETTER_AUTH_SECRET em produção (AUTH_SECRET como alternativa)", () => {
    expect(() => validateServerEnv({ NODE_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET/);
    expect(validateServerEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: "x" }).auth.secret).toBe(
      "x",
    );
    expect(validateServerEnv({ NODE_ENV: "production", AUTH_SECRET: "y" }).auth.secret).toBe("y");
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
    expect(validateServerEnv({}).ai.provider).toBe("mock");
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
