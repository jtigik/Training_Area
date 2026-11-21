import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { editedList, feedbackDisplayLists, feedbackDisplayText } from "@/lib/feedback";
import type { FeedbackEditInput, FeedbackReviewInput } from "@/lib/validation/feedback";
import { writeAudit } from "@/server/audit";
import type { TenantContext } from "@/server/auth/tenant";

type Ctx = Pick<TenantContext, "db" | "tenantId" | "user">;

const FEEDBACK_SELECT = {
  id: true,
  levelAttemptId: true,
  studentId: true,
  status: true,
  generationStatus: true,
  generationError: true,
  aiText: true,
  aiStrengths: true,
  aiToReview: true,
  editedText: true,
  editedStrengths: true,
  editedToReview: true,
  editedById: true,
  editedAt: true,
  reviewedById: true,
  reviewedAt: true,
  rejectionReason: true,
} as const;

type FeedbackRow = Prisma.FeedbackGetPayload<{ select: typeof FEEDBACK_SELECT }>;

/** Visão do professor: originais da IA (imutáveis), edição e o que o aluno verá. */
export function professorFeedbackView(row: FeedbackRow) {
  return {
    id: row.id,
    levelAttemptId: row.levelAttemptId,
    studentId: row.studentId,
    status: row.status,
    generationStatus: row.generationStatus,
    generationError: row.generationError,
    ai: { text: row.aiText, strengths: row.aiStrengths, toReview: row.aiToReview },
    edited: {
      text: row.editedText,
      strengths: editedList(row.editedStrengths),
      toReview: editedList(row.editedToReview),
      editedById: row.editedById,
      editedAt: row.editedAt?.toISOString() ?? null,
    },
    /** Versão final (editada, senão IA) — é a que o aluno vê quando APPROVED. */
    final: { text: feedbackDisplayText(row), ...feedbackDisplayLists(row) },
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
  };
}

async function load(db: Ctx["db"], id: string): Promise<FeedbackRow> {
  const row = await db.feedback.findFirst({ where: { id }, select: FEEDBACK_SELECT });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Feedback não encontrado");
  return row;
}

export async function getFeedbackForProfessor(ctx: Ctx, id: string) {
  return professorFeedbackView(await load(ctx.db, id));
}

const jsonList = (v: string[] | null) => (v === null ? Prisma.DbNull : v);

/**
 * PROFESSOR edita resumo / pontos fortes / a revisar SEPARADAMENTE, antes de aprovar.
 * Só em DRAFT ou REJECTED (aprovado → 409 NOT_EDITABLE). Os originais da IA não mudam
 * (trigger no banco). Cada edição grava AuditLog "feedback.edited" com before/after.
 */
export async function editFeedback(ctx: Ctx, id: string, input: FeedbackEditInput) {
  return ctx.db.$transaction(async (tx) => {
    const row = await load(tx as unknown as Ctx["db"], id);
    if (row.status === "APPROVED") {
      throw new ApiError(409, "NOT_EDITABLE", "Feedback aprovado não pode mais ser editado");
    }
    const before = {
      text: row.editedText,
      strengths: editedList(row.editedStrengths),
      toReview: editedList(row.editedToReview),
    };
    const data: Prisma.FeedbackUpdateInput = {};
    const after: Partial<typeof before> = {};
    if (input.text !== undefined) {
      data.editedText = input.text;
      after.text = input.text;
    }
    if (input.strengths !== undefined) {
      data.editedStrengths = jsonList(input.strengths);
      after.strengths = input.strengths;
    }
    if (input.toReview !== undefined) {
      data.editedToReview = jsonList(input.toReview);
      after.toReview = input.toReview;
    }
    const changed = Object.keys(after).filter(
      (k) =>
        JSON.stringify(before[k as keyof typeof before]) !==
        JSON.stringify(after[k as keyof typeof after]),
    );
    if (changed.length === 0) return professorFeedbackView(row);
    const updated = await tx.feedback.update({
      where: { id: row.id },
      data: { ...data, editedAt: new Date(), editedBy: { connect: { id: ctx.user.id } } },
      select: FEEDBACK_SELECT,
    });
    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.user.id,
      action: "feedback.edited",
      entityType: "Feedback",
      entityId: row.id,
      data: Object.fromEntries(
        changed.map((k) => [
          k,
          { from: before[k as keyof typeof before], to: after[k as keyof typeof after] },
        ]),
      ),
    });
    return professorFeedbackView(updated);
  });
}

/**
 * Aprova (precisa de resumo final não vazio: edição ou IA → senão 409 NO_TEXT) ou
 * rejeita (motivo). Só a partir de DRAFT; já aprovado/rejeitado → 409 ALREADY_REVIEWED.
 * Grava AuditLog com o conteúdo final aprovado.
 */
export async function reviewFeedback(ctx: Ctx, id: string, input: FeedbackReviewInput) {
  return ctx.db.$transaction(async (tx) => {
    const row = await load(tx as unknown as Ctx["db"], id);
    if (row.status !== "DRAFT") {
      throw new ApiError(409, "ALREADY_REVIEWED", "Este feedback já foi revisado");
    }
    const final = { text: feedbackDisplayText(row), ...feedbackDisplayLists(row) };
    if (input.action === "approve" && !final.text.trim()) {
      throw new ApiError(409, "NO_TEXT", "Escreva o resumo antes de aprovar");
    }
    const updated = await tx.feedback.update({
      where: { id: row.id },
      data:
        input.action === "approve"
          ? {
              status: "APPROVED",
              reviewedAt: new Date(),
              reviewedBy: { connect: { id: ctx.user.id } },
            }
          : {
              status: "REJECTED",
              rejectionReason: input.reason,
              reviewedAt: new Date(),
              reviewedBy: { connect: { id: ctx.user.id } },
            },
      select: FEEDBACK_SELECT,
    });
    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.user.id,
      action: input.action === "approve" ? "feedback.approved" : "feedback.rejected",
      entityType: "Feedback",
      entityId: row.id,
      data: input.action === "approve" ? { final } : { reason: input.reason },
    });
    return professorFeedbackView(updated);
  });
}
