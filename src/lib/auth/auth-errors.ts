/**
 * Login error codes -> message for /login. Mirrors Backend 1's src/lib/auth-errors.ts
 * (feat/auth-modelo d2bc6d0): the Better Auth callback redirects to
 * /login?error=<CODE>&error_description=<free text>; show authErrorMessage(code),
 * never error_description. Keep in sync with Backend 1 until the branches merge.
 */
export const ACCOUNT_NOT_REGISTERED_MESSAGE =
  "Sua conta não está cadastrada nesta instituição. Fale com seu professor ou administrador.";

export const DEFAULT_AUTH_ERROR_MESSAGE = "Não foi possível entrar. Tente novamente.";

const EXPIRED_ATTEMPT = "Sua tentativa de login expirou. Tente novamente.";

export const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  ACCOUNT_NOT_REGISTERED: ACCOUNT_NOT_REGISTERED_MESSAGE,
  ACCOUNT_DISABLED: "Sua conta ou instituição está desativada. Fale com o administrador.",
  // Better Auth / OAuth provider codes
  access_denied: "Login cancelado. Tente novamente quando quiser.",
  state_not_found: EXPIRED_ATTEMPT,
  state_mismatch: EXPIRED_ATTEMPT,
  please_restart_the_process: EXPIRED_ATTEMPT,
  no_code: DEFAULT_AUTH_ERROR_MESSAGE,
  unable_to_get_user_info: DEFAULT_AUTH_ERROR_MESSAGE,
  email_not_found: "Sua conta Google/Microsoft não informou um e-mail.",
  account_not_linked: "Esta conta não pôde ser vinculada ao seu usuário. Fale com o administrador.",
};

/** Message to show; unknown codes -> generic message; no code -> null. */
export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return Object.hasOwn(AUTH_ERROR_MESSAGES, code)
    ? AUTH_ERROR_MESSAGES[code]
    : DEFAULT_AUTH_ERROR_MESSAGE;
}
