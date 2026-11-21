import { describe, expect, it } from "vitest";

import { loginOptionsFrom, readAuthEnv } from "./config";

describe("readAuthEnv", () => {
  it("e-mail+senha desligado por padrão", () => {
    expect(readAuthEnv({}).emailPasswordEnabled).toBe(false);
  });

  it("liga e-mail+senha só com a flag e fora de produção", () => {
    expect(readAuthEnv({ AUTH_EMAIL_PASSWORD_ENABLED: "true" }).emailPasswordEnabled).toBe(true);
    expect(
      readAuthEnv({ AUTH_EMAIL_PASSWORD_ENABLED: "true", NODE_ENV: "production" })
        .emailPasswordEnabled,
    ).toBe(false);
  });

  it("provedores sociais exigem id e secret", () => {
    expect(readAuthEnv({ GOOGLE_CLIENT_ID: "id" }).google).toBeNull();
    expect(readAuthEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" }).google).toEqual({
      clientId: "id",
      clientSecret: "s",
    });
    expect(
      readAuthEnv({ MICROSOFT_CLIENT_ID: "id", MICROSOFT_CLIENT_SECRET: "s" }).microsoft?.tenantId,
    ).toBe("common");
  });
});

describe("modo OAuth mock (E2E)", () => {
  const mockEnv = {
    AUTH_OAUTH_MOCK_BASE_URL: "http://localhost:3199/",
    GOOGLE_CLIENT_ID: "g-id",
    GOOGLE_CLIENT_SECRET: "g-secret",
  };

  it("usa genericOAuth com os mesmos ids e endpoints {base}/{id}/...", () => {
    const config = readAuthEnv(mockEnv);
    expect(config.oauthMode).toBe("mock");
    expect(config.google).toBeNull();
    expect(config.microsoft).toBeNull();
    expect(config.mockProviders).toEqual([
      {
        providerId: "google",
        clientId: "g-id",
        clientSecret: "g-secret",
        authorizationUrl: "http://localhost:3199/google/authorize",
        tokenUrl: "http://localhost:3199/google/token",
        userInfoUrl: "http://localhost:3199/google/userinfo",
      },
      {
        providerId: "microsoft",
        clientId: "mock-microsoft-client",
        clientSecret: "mock-microsoft-secret",
        authorizationUrl: "http://localhost:3199/microsoft/authorize",
        tokenUrl: "http://localhost:3199/microsoft/token",
        userInfoUrl: "http://localhost:3199/microsoft/userinfo",
      },
    ]);
  });

  it("é ignorado em produção (volta ao nativo)", () => {
    const config = readAuthEnv({ ...mockEnv, NODE_ENV: "production" });
    expect(config.oauthMode).toBe("native");
    expect(config.mockProviders).toEqual([]);
    expect(config.google).toEqual({ clientId: "g-id", clientSecret: "g-secret" });
  });

  it("ignora URL inválida ou vazia", () => {
    expect(readAuthEnv({ AUTH_OAUTH_MOCK_BASE_URL: "nao-e-url" }).oauthMode).toBe("native");
    expect(readAuthEnv({ AUTH_OAUTH_MOCK_BASE_URL: "ftp://x" }).oauthMode).toBe("native");
    expect(readAuthEnv({ AUTH_OAUTH_MOCK_BASE_URL: " " }).oauthMode).toBe("native");
  });
});

describe("loginOptionsFrom", () => {
  it("nativo: só provedores com credenciais", () => {
    const options = loginOptionsFrom(
      readAuthEnv({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" }),
    );
    expect(options).toEqual({
      providers: [{ id: "google", label: "Google" }],
      emailPassword: false,
      oauthMode: "native",
    });
  });

  it("mock: Google e Microsoft sempre", () => {
    const options = loginOptionsFrom(
      readAuthEnv({
        AUTH_OAUTH_MOCK_BASE_URL: "http://localhost:3199",
        AUTH_EMAIL_PASSWORD_ENABLED: "true",
      }),
    );
    expect(options.providers.map((p) => p.id)).toEqual(["google", "microsoft"]);
    expect(options.emailPassword).toBe(true);
    expect(options.oauthMode).toBe("mock");
  });
});

describe("AUTH_TEST_MODE (build de produção da CI/E2E)", () => {
  const base = {
    NODE_ENV: "production",
    AUTH_EMAIL_PASSWORD_ENABLED: "true",
    AUTH_OAUTH_MOCK_BASE_URL: "http://127.0.0.1:4010/",
  };

  it("em produção sem AUTH_TEST_MODE, senha e OAuth falso ficam desligados", () => {
    expect(readAuthEnv(base)).toMatchObject({ emailPasswordEnabled: false, oauthMode: "native" });
    expect(readAuthEnv({ ...base, AUTH_TEST_MODE: "true" })).toMatchObject({
      emailPasswordEnabled: false,
      oauthMode: "native",
    });
  });

  it("com AUTH_TEST_MODE=1 liga os dois", () => {
    const cfg = readAuthEnv({ ...base, AUTH_TEST_MODE: "1" });
    expect(cfg).toMatchObject({ emailPasswordEnabled: true, oauthMode: "mock" });
    expect(cfg.mockProviders[0]?.authorizationUrl).toBe("http://127.0.0.1:4010/google/authorize");
  });
});
