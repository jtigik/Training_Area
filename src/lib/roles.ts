/**
 * Papéis. Os códigos espelham o enum `Role` do Prisma (conferido em
 * src/lib/enums-sync.test.ts); os rótulos são pt-BR.
 * Arquivo puro: pode ser usado no cliente e no servidor.
 */
export const ROLES = ["SUPER_ADMIN", "INSTITUTION_ADMIN", "PROFESSOR", "ALUNO"] as const;

export type Role = (typeof ROLES)[number];

/** Papéis que pertencem a uma instituição (tenantId obrigatório). */
export const TENANT_ROLES = [
  "INSTITUTION_ADMIN",
  "PROFESSOR",
  "ALUNO",
] as const satisfies readonly Role[];
export type TenantRole = (typeof TENANT_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  INSTITUTION_ADMIN: "Admin da instituição",
  PROFESSOR: "Professor",
  ALUNO: "Aluno",
};

/** Painel inicial de cada papel (destino após o login). */
export const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/super-admin",
  INSTITUTION_ADMIN: "/admin",
  PROFESSOR: "/professor",
  ALUNO: "/aluno",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isTenantRole(value: unknown): value is TenantRole {
  return typeof value === "string" && (TENANT_ROLES as readonly string[]).includes(value);
}

export function hasAnyRole(role: unknown, allowed: readonly Role[]): boolean {
  return isRole(role) && allowed.includes(role);
}
