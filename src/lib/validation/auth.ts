import { z } from "zod";

import { TENANT_ROLES } from "@/lib/roles";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const SOCIAL_PROVIDERS = ["google", "microsoft"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "E-mail inválido" }));

/** Login social (lançamento). */
export const socialSignInSchema = z.object({
  provider: z.enum(SOCIAL_PROVIDERS),
  callbackURL: z.string().startsWith("/").optional(),
});

/** Login por e-mail e senha — SÓ dev/teste (AUTH_EMAIL_PASSWORD_ENABLED=true). */
export const devSignInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Informe a senha" }).max(PASSWORD_MAX_LENGTH),
});

/**
 * Alteração de papel (TA-002). SUPER_ADMIN não é atribuível por esta via:
 * só por seed/operação de plataforma.
 */
export const updateRoleSchema = z.object({
  role: z.enum(TENANT_ROLES, { error: "Papel inválido" }),
});

export type SocialSignInInput = z.infer<typeof socialSignInSchema>;
export type DevSignInInput = z.infer<typeof devSignInSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

/** Mensagem genérica (não revela se a conta existe — TA-001). */
export const GENERIC_SIGN_IN_ERROR = "Não foi possível entrar com esta conta";
export { ACCOUNT_NOT_REGISTERED_MESSAGE as NO_TENANT_SIGN_IN_ERROR } from "@/lib/auth-errors";
