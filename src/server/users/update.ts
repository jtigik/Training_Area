import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import type { UserUpdateInput } from "@/lib/validation/user";
import { diffFields, writeAudit } from "@/server/audit";
import type { TenantContext } from "@/server/auth/tenant";
import { prisma } from "@/server/db";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  tenantId: true,
  active: true,
} as const;

/**
 * INSTITUTION_ADMIN edita nome / e-mail / ativo de um usuário DA PRÓPRIA instituição.
 * - outro tenant ou inexistente → 404 NOT_FOUND (não vaza existência);
 * - desativar a si mesmo → 422 CANNOT_DEACTIVATE_SELF;
 * - e-mail de outra conta OU com convite pendente (qualquer instituição) → 409 EMAIL_TAKEN;
 * - active=false desativa (não exclui) e revoga todas as sessões do usuário;
 * - AuditLog "user.updated" com before/after dos campos alterados (mesma transação).
 */
export async function updateTenantUser(
  ctx: Pick<TenantContext, "db" | "tenantId" | "user">,
  targetUserId: string,
  input: UserUpdateInput,
) {
  if (input.active === false && targetUserId === ctx.user.id) {
    throw new ApiError(422, "CANNOT_DEACTIVATE_SELF", "Você não pode desativar a própria conta");
  }
  return ctx.db.$transaction(
    async (tx) => {
      const target = await tx.user.findFirst({ where: { id: targetUserId }, select: USER_SELECT });
      if (!target) throw new ApiError(404, "NOT_FOUND", "Usuário não encontrado");

      const changes: UserUpdateInput = {};
      if (input.name !== undefined && input.name !== target.name) changes.name = input.name;
      if (input.active !== undefined && input.active !== target.active) {
        changes.active = input.active;
      }
      if (input.email !== undefined && input.email !== target.email) {
        // Unicidade GLOBAL e intencional (e-mail único na plataforma): cliente base.
        const [owner, pending] = await Promise.all([
          prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
          prisma.invitation.findFirst({
            where: { email: input.email, acceptedAt: null, expiresAt: { gt: new Date() } },
            select: { id: true },
          }),
        ]);
        if (owner || pending) {
          throw new ApiError(409, "EMAIL_TAKEN", "Este e-mail já está em uso na plataforma");
        }
        changes.email = input.email;
      }
      if (Object.keys(changes).length === 0) return { user: target, changed: [] as string[] };

      const user = await tx.user
        .update({ where: { id: target.id }, data: changes, select: USER_SELECT })
        .catch((error: unknown) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new ApiError(409, "EMAIL_TAKEN", "Este e-mail já está em uso na plataforma");
          }
          throw error;
        });
      if (changes.active === false) {
        // Session é "blocked" no forTenant: revogação pelo cliente base, só deste usuário.
        await prisma.session.deleteMany({ where: { userId: target.id } });
      }
      await writeAudit(tx, {
        tenantId: ctx.tenantId,
        actorId: ctx.user.id,
        action: "user.updated",
        entityType: "User",
        entityId: target.id,
        data: {
          changes: diffFields(target, changes),
          ...(changes.active === false && { sessionsRevoked: true }),
        },
      });
      return { user, changed: Object.keys(changes) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
