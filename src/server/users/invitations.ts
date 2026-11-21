import "server-only";

import { ApiError } from "@/lib/api-error";

import { normalizeEmail, type InvitationInput } from "@/lib/validation/invitation";
import { prisma } from "@/server/db";
import type { TenantContext } from "@/server/auth/tenant";

export class InvitationError extends ApiError {
  declare readonly code: "EMAIL_IN_USE" | "PENDING_INVITATION";
  constructor(code: "EMAIL_IN_USE" | "PENDING_INVITATION", message: string) {
    super(409, code, message);
    this.name = "InvitationError";
  }
}

export type InvitationConflict = InvitationError["code"] | null;

/**
 * Regra do MVP: e-mail único na plataforma. Não convida quem já tem conta
 * (em qualquer instituição) nem quem já tem convite pendente em outra
 * instituição. Convite pendente na MESMA instituição é renovado.
 * Mensagens não dizem em qual instituição está o e-mail.
 */
export function invitationConflict(
  existingUser: { tenantId: string | null } | null,
  pendingInvitation: { tenantId: string; expiresAt: Date } | null,
  tenantId: string,
  now: Date = new Date(),
): InvitationConflict {
  if (existingUser) return "EMAIL_IN_USE";
  if (
    pendingInvitation &&
    pendingInvitation.tenantId !== tenantId &&
    pendingInvitation.expiresAt > now
  ) {
    return "PENDING_INVITATION";
  }
  return null;
}

const MESSAGES = {
  EMAIL_IN_USE: "Este e-mail já tem uma conta na plataforma",
  PENDING_INVITATION: "Este e-mail já tem um convite pendente em outra instituição",
} as const;

/** INSTITUTION_ADMIN/SUPER_ADMIN: cria ou renova o convite (valide com invitationInputSchema). */
export async function createInvitation(ctx: TenantContext, input: InvitationInput) {
  const email = normalizeEmail(input.email);
  // Verificação GLOBAL e intencional (e-mail único na plataforma): cliente base.
  return prisma.$transaction(async (tx) => {
    const [user, pending] = await Promise.all([
      tx.user.findUnique({ where: { email }, select: { tenantId: true } }),
      tx.invitation.findFirst({
        where: { email, acceptedAt: null },
        select: { id: true, tenantId: true, expiresAt: true },
      }),
    ]);
    const conflict = invitationConflict(user, pending, ctx.tenantId);
    if (conflict) throw new InvitationError(conflict, MESSAGES[conflict]);

    // Convite expirado de outra instituição ou pendente desta: substitui.
    if (pending) await tx.invitation.delete({ where: { id: pending.id } });

    return tx.invitation.create({
      data: {
        tenantId: ctx.tenantId,
        email,
        role: input.role,
        invitedById: ctx.user.id,
        expiresAt: new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000),
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
  });
}
