import "server-only";

import { feedbackDisplayText } from "@/lib/feedback";
import { prisma } from "@/server/db";
import type { TenantContext } from "@/server/auth/tenant";

export interface StudentFeedbackView {
  id: string;
  levelAttemptId: string;
  text: string;
  reviewedAt: Date | null;
}

/**
 * Feedbacks que o ALUNO pode ler: só APPROVED, só os dele, só do tenant.
 * Nunca expõe aiText cru, status de revisão ou rejectionReason.
 * Use SEMPRE este helper nas rotas/telas do aluno.
 */
export async function listApprovedFeedbackForStudent(
  ctx: TenantContext,
  filter: { levelAttemptId?: string } = {},
): Promise<StudentFeedbackView[]> {
  const rows = await prisma.feedback.findMany({
    where: {
      tenantId: ctx.tenantId,
      studentId: ctx.user.id,
      status: "APPROVED",
      ...(filter.levelAttemptId && { levelAttemptId: filter.levelAttemptId }),
    },
    select: { id: true, levelAttemptId: true, aiText: true, editedText: true, reviewedAt: true },
    orderBy: { reviewedAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    levelAttemptId: row.levelAttemptId,
    text: feedbackDisplayText(row),
    reviewedAt: row.reviewedAt,
  }));
}

export async function getApprovedFeedbackForStudent(
  ctx: TenantContext,
  levelAttemptId: string,
): Promise<StudentFeedbackView | null> {
  const [feedback] = await listApprovedFeedbackForStudent(ctx, { levelAttemptId });
  return feedback ?? null;
}
