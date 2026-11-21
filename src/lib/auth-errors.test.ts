import { describe, expect, it } from "vitest";

import { ACCOUNT_NOT_REGISTERED_MESSAGE, AUTH_ERROR_CODES, authErrorMessage } from "./auth-errors";
import { NO_TENANT_SIGN_IN_ERROR } from "./validation/auth";

describe("auth-errors", () => {
  it("ACCOUNT_NOT_REGISTERED tem a mensagem definida pelo PO", () => {
    expect(authErrorMessage(AUTH_ERROR_CODES.ACCOUNT_NOT_REGISTERED)).toBe(
      "Sua conta não está cadastrada nesta instituição. Fale com seu professor ou administrador.",
    );
    // O hook do Better Auth usa a mesma mensagem.
    expect(NO_TENANT_SIGN_IN_ERROR).toBe(ACCOUNT_NOT_REGISTERED_MESSAGE);
  });

  it("códigos desconhecidos → genérica; ausente → null", () => {
    expect(authErrorMessage("qualquer_coisa")).toBe("Não foi possível entrar. Tente novamente.");
    expect(authErrorMessage(null)).toBeNull();
    expect(authErrorMessage("access_denied")).toMatch(/cancelado/);
  });
});
