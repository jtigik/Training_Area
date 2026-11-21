import "server-only";

import { ApiError } from "@/lib/api-error";

import { normalizeEmail, type InvitationInput } from "@/lib/validation/invitation";
import { writeAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import type { TenantContext } from "@/server/auth/tenant";

type InvitationErrorCode = "EMAIL_IN_USE" | "PENDING_INVITATION" | "USER_INACTIVE";

export class InvitationError extends ApiError {
  declare readonly code: InvitationErrorCode;
  constructor(code: InvitationErrorCode, message: string) {
    super(409, code, message);
    this.name = "InvitationError";
  }
}

export type InvitationConflict = InvitationError["code"] | null;

/**
 * Regra do MVP: e-mail único na plataforma.
 * - conta ATIVA (qualquer instituição) → 409 EMAIL_IN_USE;
 * - conta DESATIVADA desta instituição → 409 USER_INACTIVE (reative em
 *   PATCH /api/admin/users/:id; convite não recria conta existente);
 *   desativada de outra instituição → EMAIL_IN_USE (não revela a instituição);
 * - convite pendente válido em OUTRA instituição → 409 PENDING_INVITATION;
 * - convite pendente nesta instituição (ou expirado em qualquer uma) → substitui
 *   (o antigo é apagado, o novo tem id e validade novos) e responde 200.
 */
export function invitationConflict(
  existingUser: { tenantId: string | null; active?: boolean } | null,
  pendingInvitation: { tenantId: string; expiresAt: Date } | null,
  tenantId: string,
  now: Date = new Date(),
): InvitationConflict {
  if (existingUser) {
    return existingUser.active === false && existingUser.tenantId === tenantId
      ? "USER_INACTIVE"
      : "EMAIL_IN_USE";
  }
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
  USER_INACTIVE: "Este e-mail pertence a um usuário desativado desta instituição; reative-o",
} as const;

/**
 * INSTITUTION_ADMIN/SUPER_ADMIN: cria ou renova o convite (valide com invitationInputSchema).
 * `renewed` = substituiu um convite pendente desta instituição (rota responde 200; novo = 201).
 * Grava AuditLog (invitation.created | invitation.renewed) na mesma transação.
 */
export async function createInvitation(ctx: TenantContext, input: InvitationInput) {
  const email = normalizeEmail(input.email);
  // Verificação GLOBAL e intencional (e-mail único na plataforma): cliente base.
  return prisma.$transaction(async (tx) => {
    const [user, pending] = await Promise.all([
      tx.user.findUnique({ where: { email }, select: { tenantId: true, active: true } }),
      tx.invitation.findFirst({
        where: { email, acceptedAt: null },
        select: { id: true, tenantId: true, expiresAt: true, role: true },
      }),
    ]);
    const conflict = invitationConflict(user, pending, ctx.tenantId);
    if (conflict) throw new InvitationError(conflict, MESSAGES[conflict]);

    // Convite expirado de outra instituição ou pendente desta: substitui
    // (o antigo deixa de existir: o aceite é pelo e-mail + convite vigente).
    if (pending) await tx.invitation.delete({ where: { id: pending.id } });
    const renewed = pending !== null && pending.tenantId === ctx.tenantId;

    const invitation = await tx.invitation.create({
      data: {
        tenantId: ctx.tenantId,
        email,
        role: input.role,
        invitedById: ctx.user.id,
        expiresAt: new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000),
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.user.id,
      action: renewed ? "invitation.renewed" : "invitation.created",
      entityType: "Invitation",
      entityId: invitation.id,
      data: {
        email,
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
        ...(renewed && {
          replacedInvitationId: pending.id,
          previousRole: pending.role,
          previousExpiresAt: pending.expiresAt.toISOString(),
        }),
      },
    });
    return { invitation, renewed };
  });
}
