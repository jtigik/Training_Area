import "server-only";

import { feedbackDisplayText } from "@/lib/feedback";
import type { TenantContext } from "@/server/auth/tenant";

export interface StudentFeedbackView {
  id: string;
  levelAttemptId: string;
  text: string;
  strengths: string[];
  toReview: string[];
  reviewedAt: Date | null;
}

/**
 * Feedbacks que o ALUNO pode ler: só APPROVED, só os dele, só do tenant.
 * Nunca expõe aiText cru, status de revisão/geração, generationError ou rejectionReason.
 * Use SEMPRE este helper nas rotas/telas do aluno.
 */
export async function listApprovedFeedbackForStudent(
  ctx: Pick<TenantContext, "db" | "user">,
  filter: { levelAttemptId?: string } = {},
): Promise<StudentFeedbackView[]> {
  const rows = await ctx.db.feedback.findMany({
    where: {
      studentId: ctx.user.id,
      status: "APPROVED",
      ...(filter.levelAttemptId && { levelAttemptId: filter.levelAttemptId }),
    },
    select: {
      id: true,
      levelAttemptId: true,
      aiText: true,
      editedText: true,
      strengths: true,
      toReview: true,
      reviewedAt: true,
    },
    orderBy: { reviewedAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    levelAttemptId: row.levelAttemptId,
    text: feedbackDisplayText(row),
    strengths: row.strengths,
    toReview: row.toReview,
    reviewedAt: row.reviewedAt,
  }));
}

export async function getApprovedFeedbackForStudent(
  ctx: Pick<TenantContext, "db" | "user">,
  levelAttemptId: string,
): Promise<StudentFeedbackView | null> {
  const [feedback] = await listApprovedFeedbackForStudent(ctx, { levelAttemptId });
  return feedback ?? null;
}
