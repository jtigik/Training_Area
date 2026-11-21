import "server-only";

import { resolveTenantScope } from "@/lib/authz/tenant";
import type { Role } from "@/lib/roles";
import { AuthError, requireRole, type AppSession } from "@/server/auth/session";
import { forTenant, type TenantDb } from "@/server/tenant-db";

export interface TenantContext extends AppSession {
  /** Tenant efetivo da operação: SEMPRE filtre consultas por ele. */
  tenantId: string;
  /** Cliente Prisma com escopo do tenant (forTenant): use-o em vez de `prisma`. */
  db: TenantDb;
  /** "platform" para SUPER_ADMIN: ctx.db recusa registros individuais da instituição. */
  access: "member" | "platform";
}

const TENANT_ERRORS = {
  TENANT_REQUIRED: "Informe a instituição (tenantId) para esta operação",
  CROSS_TENANT: "Acesso negado a dados de outra instituição",
  NO_TENANT: "Usuário sem instituição",
} as const;

/**
 * Exige papel + resolve o tenant da operação (TA-003, multi-tenant).
 * - Usuário de instituição: tenant = session.user.tenantId; pedir outro → 403.
 * - SUPER_ADMIN: precisa informar `requestedTenantId` (senão 400); é o único
 *   que atravessa instituições, mas com access "platform": ctx.db só alcança
 *   configuração (faixas, convite, dados do tenant), nunca alunos, tentativas,
 *   feedbacks ou PII (TenantScopeError → 403 SCOPE_DENIED).
 *
 * Uso: const { db, user } = await requireTenant(["PROFESSOR", "INSTITUTION_ADMIN"]);
 *      db.exerciseSet.findMany()   // tenantId injetado pela extensão
 */
export async function requireTenant(
  allowed: Role | readonly Role[],
  options: { requestedTenantId?: string | null; headers?: Headers } = {},
): Promise<TenantContext> {
  const session = await requireRole(allowed, options.headers);
  const scope = resolveTenantScope(session.user, options.requestedTenantId);
  if (!scope.ok) throw new AuthError(scope.status, TENANT_ERRORS[scope.code], scope.code);
  const access = session.user.role === "SUPER_ADMIN" ? "platform" : "member";
  return { ...session, tenantId: scope.tenantId, access, db: forTenant(scope.tenantId, access) };
}

/** Garante que um registro carregado pertence ao tenant da operação (404 semântico → 403). */
export function assertSameTenant(ctx: TenantContext, recordTenantId: string | null): void {
  if (recordTenantId !== ctx.tenantId) {
    throw new AuthError(403, TENANT_ERRORS.CROSS_TENANT, "CROSS_TENANT");
  }
}
