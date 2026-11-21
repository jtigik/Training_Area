import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { TenantRole } from "@/lib/roles";
import type { TenantContext } from "@/server/auth/tenant";

export class RoleChangeError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "LAST_ADMIN",
    message: string,
  ) {
    super(message);
    this.name = "RoleChangeError";
  }
}

/**
 * Altera o papel de um usuário DENTRO de um tenant (TA-002). Usuário de outro
 * tenant é tratado como inexistente (não vaza existência). Recusa rebaixar o
 * último INSTITUTION_ADMIN ativo da instituição. Transação serializável.
 * Quem chama garante a autorização (requireTenant com INSTITUTION_ADMIN/SUPER_ADMIN).
 */
export async function changeUserRole(
  ctx: Pick<TenantContext, "db">,
  targetUserId: string,
  role: TenantRole,
) {
  return ctx.db.$transaction(
    async (tx) => {
      const target = await tx.user.findFirst({
        where: { id: targetUserId },
        select: { id: true, role: true, active: true },
      });
      if (!target) throw new RoleChangeError("NOT_FOUND", "Usuário não encontrado");

      if (target.role === "INSTITUTION_ADMIN" && role !== "INSTITUTION_ADMIN" && target.active) {
        const admins = await tx.user.count({
          where: { role: "INSTITUTION_ADMIN", active: true },
        });
        if (admins <= 1) {
          throw new RoleChangeError(
            "LAST_ADMIN",
            "Não é possível rebaixar o último administrador da instituição",
          );
        }
      }

      return tx.user.update({
        where: { id: target.id },
        data: { role },
        select: { id: true, name: true, email: true, role: true, tenantId: true, active: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
