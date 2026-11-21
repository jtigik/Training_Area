import "server-only";

import { prisma } from "@/server/db";
import { scopeArgs, type TenantAccess } from "@/server/tenant-scope";

export { TenantScopeError, type TenantAccess } from "@/server/tenant-scope";

/**
 * Cliente Prisma com escopo de tenant (isolamento centralizado — decisão do PO).
 *
 *   const db = forTenant(ctx.tenantId);        // ou ctx.db de requireTenant()
 *   await db.exerciseSet.findMany();            // só do tenant
 *   await db.exercise.findMany({ where: { level: "FUNDAMENTAL" } }); // tenant + globais
 *   await db.exerciseSet.create({ data: { tenantId, name, difficulties } });
 *     // os tipos do Prisma exigem tenantId no create; a extensão injeta/confere
 *     // e recusa (TenantScopeError) qualquer tenantId diferente.
 *
 * Regras por modelo em src/server/tenant-scope.ts. Limitações (Prisma):
 *  - relações aninhadas (include/select de filhos, nested create/connect) não
 *    são reescritas: filtre/crie pelo modelo filho no próprio `db`;
 *  - $queryRaw/$executeRaw não são escopados — evite ou filtre à mão.
 * O cliente base (`prisma` de @/server/db) só para: Better Auth, seed,
 * operações de plataforma (SUPER_ADMIN, globais) e verificações globais
 * explícitas (ex.: e-mail único na plataforma).
 */
/**
 * access "platform" (SUPER_ADMIN): só configuração da instituição, nunca
 * registros individuais (PLATFORM_ALLOWED em tenant-scope.ts).
 */
export function forTenant(tenantId: string, access: TenantAccess = "member") {
  if (!tenantId) throw new Error("forTenant: tenantId obrigatório");
  return prisma.$extends({
    name: `tenant:${access}:${tenantId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(
            scopeArgs(
              model,
              operation,
              args as Record<string, unknown>,
              tenantId,
              access,
            ) as typeof args,
          );
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof forTenant>;
