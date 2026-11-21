import type { Role } from "@/lib/roles";

/**
 * Isolamento por instituição (tenant). Funções puras; os helpers de servidor
 * (src/server/auth/tenant.ts) as aplicam à sessão.
 *
 * Regra: todo usuário opera no PRÓPRIO tenant (session.user.tenantId). Só o
 * SUPER_ADMIN atravessa tenants, e precisa dizer explicitamente em qual.
 * Registros globais (tenantId nulo: Exercise/ContentSection do banco inicial)
 * são legíveis por qualquer tenant e graváveis só pelo SUPER_ADMIN.
 */

export interface TenantSubject {
  role: Role;
  tenantId: string | null;
}

export type TenantScopeResult =
  | { ok: true; tenantId: string }
  | { ok: false; status: 400 | 403; code: "TENANT_REQUIRED" | "CROSS_TENANT" | "NO_TENANT" };

/** Resolve o tenant efetivo de uma operação. */
export function resolveTenantScope(
  user: TenantSubject,
  requestedTenantId?: string | null,
): TenantScopeResult {
  if (user.role === "SUPER_ADMIN") {
    return requestedTenantId
      ? { ok: true, tenantId: requestedTenantId }
      : { ok: false, status: 400, code: "TENANT_REQUIRED" };
  }
  if (!user.tenantId) return { ok: false, status: 403, code: "NO_TENANT" };
  if (requestedTenantId && requestedTenantId !== user.tenantId) {
    return { ok: false, status: 403, code: "CROSS_TENANT" };
  }
  return { ok: true, tenantId: user.tenantId };
}

/** O usuário pode LER um registro com este tenantId (nulo = global)? */
export function canReadTenantRecord(user: TenantSubject, recordTenantId: string | null): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  return recordTenantId === null || recordTenantId === user.tenantId;
}

/** O usuário pode ESCREVER num registro com este tenantId (nulo = global)? */
export function canWriteTenantRecord(user: TenantSubject, recordTenantId: string | null): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  return recordTenantId !== null && recordTenantId === user.tenantId;
}

/** Filtro Prisma para registros do tenant (sem globais). */
export function tenantOnlyWhere(tenantId: string) {
  return { tenantId };
}

/** Filtro Prisma para registros do tenant + globais (Exercise/ContentSection). */
export function tenantOrGlobalWhere(tenantId: string) {
  return { OR: [{ tenantId }, { tenantId: null }] };
}
