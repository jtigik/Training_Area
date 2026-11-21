import { describe, expect, it } from "vitest";

import { readAuthEnv } from "./config";

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
