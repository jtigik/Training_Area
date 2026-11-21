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
    expect(env.auth.microsoftEntraId).toBeUndefined();
    expect(env.tenancy).toEqual({
      resolution: "single",
      defaultSlug: "default",
      rootDomain: undefined,
    });
  });

  it("exige AUTH_SECRET em produção", () => {
    expect(() => validateServerEnv({ NODE_ENV: "production" })).toThrow(/AUTH_SECRET/);
    expect(validateServerEnv({ NODE_ENV: "production", AUTH_SECRET: "x" }).auth.secret).toBe("x");
  });

  it("exige id e secret do OAuth em par", () => {
    expect(() => validateServerEnv({ AUTH_GOOGLE_ID: "id" })).toThrow(/AUTH_GOOGLE_SECRET/);
    const env = validateServerEnv({
      AUTH_MICROSOFT_ENTRA_ID_ID: "id",
      AUTH_MICROSOFT_ENTRA_ID_SECRET: "s",
      AUTH_MICROSOFT_ENTRA_ID_ISSUER: "https://login.microsoftonline.com/common/v2.0",
    });
    expect(env.auth.microsoftEntraId?.issuer).toContain("microsoftonline");
  });

  it("exige AI_API_KEY para provedores reais e rejeita provedor desconhecido", () => {
    expect(() => validateServerEnv({ AI_PROVIDER: "openai" })).toThrow(/AI_API_KEY/);
    expect(() => validateServerEnv({ AI_PROVIDER: "foo" })).toThrow(EnvValidationError);
    expect(validateServerEnv({ AI_PROVIDER: "anthropic", AI_API_KEY: "k" }).ai.provider).toBe(
      "anthropic",
    );
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
