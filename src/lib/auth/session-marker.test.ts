import { beforeEach, describe, expect, it } from "vitest";
import { clearSessionMarker, hadSession, loginRedirectPath, markSignedIn } from "./session-marker";

describe("session marker", () => {
  beforeEach(() => window.localStorage.clear());

  it("builds the login URL with the expired notice only after a real session", () => {
    expect(loginRedirectPath("/aluno/conteudo", false)).toBe(
      "/login?callbackUrl=%2Faluno%2Fconteudo",
    );
    expect(loginRedirectPath("/aluno", true)).toBe(
      "/login?motivo=sessao-expirada&callbackUrl=%2Faluno",
    );
    expect(loginRedirectPath(null, false)).toBe("/login?callbackUrl=%2Faluno");
  });

  it("is stable across reads (parallel 401s) and cleared on logout", () => {
    expect(hadSession()).toBe(false);
    markSignedIn();
    expect(hadSession()).toBe(true);
    expect(hadSession()).toBe(true);
    markSignedIn();
    clearSessionMarker();
    expect(hadSession()).toBe(false);
  });
});
