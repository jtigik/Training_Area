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
