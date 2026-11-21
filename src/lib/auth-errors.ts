/**
 * Códigos de erro de login → mensagem para a tela /login (FE1).
 *
 * Login social com problema: o callback do Better Auth redireciona o navegador
 * para `/login?error=<CÓDIGO>&error_description=<mensagem>` (onAPIError.errorURL).
 * Use authErrorMessage(searchParams.get("error")) em vez de exibir
 * error_description (texto livre). Chamadas JSON em /api/* continuam com 401/403.
 */
export const AUTH_ERROR_CODES = {
  /** E-mail sem convite pendente nem domínio da instituição com entrada automática. */
  ACCOUNT_NOT_REGISTERED: "ACCOUNT_NOT_REGISTERED",
  /** Usuário ou instituição desativados. */
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export const ACCOUNT_NOT_REGISTERED_MESSAGE =
  "Sua conta não está cadastrada nesta instituição. Fale com seu professor ou administrador.";

export const DEFAULT_AUTH_ERROR_MESSAGE = "Não foi possível entrar. Tente novamente.";

export const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  ACCOUNT_NOT_REGISTERED: ACCOUNT_NOT_REGISTERED_MESSAGE,
  ACCOUNT_DISABLED: "Sua conta ou instituição está desativada. Fale com o administrador.",
  // Códigos do próprio Better Auth / provedor OAuth
  access_denied: "Login cancelado. Tente novamente quando quiser.",
  state_not_found: "Sua tentativa de login expirou. Tente novamente.",
  state_mismatch: "Sua tentativa de login expirou. Tente novamente.",
  please_restart_the_process: "Sua tentativa de login expirou. Tente novamente.",
  no_code: DEFAULT_AUTH_ERROR_MESSAGE,
  unable_to_get_user_info: DEFAULT_AUTH_ERROR_MESSAGE,
  email_not_found: "Sua conta Google/Microsoft não informou um e-mail.",
  account_not_linked: "Esta conta não pôde ser vinculada ao seu usuário. Fale com o administrador.",
};

/** Mensagem pronta para exibir; códigos desconhecidos/ausentes → mensagem genérica. */
export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return AUTH_ERROR_MESSAGES[code] ?? DEFAULT_AUTH_ERROR_MESSAGE;
}
