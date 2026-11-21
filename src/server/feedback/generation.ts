import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { writeAudit } from "@/server/audit";
import type { TenantDb } from "@/server/tenant-db";

/**
 * (Re)geração do feedback pela IA — ÚNICO caminho que grava aiText/aiStrengths/aiToReview.
 * O BE2 chama depois de rodar o provedor (src/server/ai):
 * - só enquanto o feedback está em revisão DRAFT; APPROVED/REJECTED → 409 NOT_REGENERABLE;
 * - cada chamada acrescenta uma linha em FeedbackGeneration (sequence 1, 2, 3...), sucesso ou falha;
 * - GENERATED: Feedback.ai* passam a espelhar esta geração (generationCount = sequence);
 * - FAILED: registra o erro; se já havia geração boa, os ai* dela ficam (generationStatus
 *   continua GENERATED, generationError preenchido); senão generationStatus = FAILED;
 * - os campos edited* (edição do professor) NUNCA são tocados aqui.
 * O banco reforça: trigger só deixa ai* mudarem com generation_count + 1 em DRAFT.
 */
export type GenerationResult =
  | {
      status: "GENERATED";
      aiText: string;
      strengths: string[];
      toReview: string[];
      aiModel?: string | null;
      promptVersion?: string | null;
    }
  | { status: "FAILED"; error: string; aiModel?: string | null; promptVersion?: string | null };

export async function recordFeedbackGeneration(
  db: TenantDb,
  tenantId: string,
  feedbackId: string,
  result: GenerationResult,
) {
  try {
    return await db.$transaction(async (tx) => {
      const fb = await tx.feedback.findFirst({
        where: { id: feedbackId },
        select: { id: true, status: true, generationStatus: true, generationCount: true },
      });
      if (!fb) throw new ApiError(404, "NOT_FOUND", "Feedback não encontrado");
      if (fb.status !== "DRAFT") {
        throw new ApiError(
          409,
          "NOT_REGENERABLE",
          "Feedback já revisado (aprovado ou rejeitado): não pode ser gerado de novo",
        );
      }
      const sequence = fb.generationCount + 1;
      const meta = { aiModel: result.aiModel ?? null, promptVersion: result.promptVersion ?? null };
      const generation = await tx.feedbackGeneration.create({
        data: {
          tenantId,
          feedbackId,
          sequence,
          status: result.status,
          ...meta,
          ...(result.status === "GENERATED"
            ? { aiText: result.aiText, strengths: result.strengths, toReview: result.toReview }
            : { error: result.error }),
        },
      });
      const feedback = await tx.feedback.update({
        where: { id: feedbackId },
        data:
          result.status === "GENERATED"
            ? {
                generationCount: sequence,
                generationStatus: "GENERATED",
                generationError: null,
                aiText: result.aiText,
                aiStrengths: result.strengths,
                aiToReview: result.toReview,
                ...meta,
              }
            : {
                generationCount: sequence,
                generationStatus: fb.generationStatus === "GENERATED" ? "GENERATED" : "FAILED",
                generationError: result.error,
              },
      });
      await writeAudit(tx, {
        tenantId,
        actorId: null,
        action: "feedback.generated",
        entityType: "Feedback",
        entityId: feedbackId,
        data: { generationId: generation.id, sequence, status: result.status },
      });
      return { feedback, generation };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(
        409,
        "GENERATION_IN_PROGRESS",
        "Outra geração foi registrada ao mesmo tempo",
      );
    }
    throw e;
  }
}

/** Histórico de gerações (mais antiga primeiro). */
export async function listFeedbackGenerations(db: TenantDb, feedbackId: string) {
  const fb = await db.feedback.findFirst({ where: { id: feedbackId }, select: { id: true } });
  if (!fb) throw new ApiError(404, "NOT_FOUND", "Feedback não encontrado");
  return db.feedbackGeneration.findMany({
    where: { feedbackId },
    orderBy: { sequence: "asc" },
  });
}
