import { describe, expect, it } from "vitest";
import { authErrorMessage, DEFAULT_AUTH_ERROR_MESSAGE } from "./auth-errors";

describe("authErrorMessage", () => {
  it("maps known codes (incl. Better Auth ones)", () => {
    expect(authErrorMessage("ACCOUNT_NOT_REGISTERED")).toBe(
      "Sua conta não está cadastrada nesta instituição. Fale com seu professor ou administrador.",
    );
    expect(authErrorMessage("ACCOUNT_DISABLED")).toMatch(/desativada/);
    expect(authErrorMessage("access_denied")).toMatch(/cancelado/);
    expect(authErrorMessage("state_mismatch")).toMatch(/expirou/);
  });

  it("falls back to a generic message for unknown codes, null without a code", () => {
    expect(authErrorMessage("SOMETHING_NEW")).toBe(DEFAULT_AUTH_ERROR_MESSAGE);
    expect(authErrorMessage("toString")).toBe(DEFAULT_AUTH_ERROR_MESSAGE);
    expect(authErrorMessage(null)).toBeNull();
    expect(authErrorMessage("")).toBeNull();
  });
});
