import "server-only";

import { ApiError } from "@/lib/api-error";

import { computeConcept, DEFAULT_GRADING_BANDS, type GradingBands } from "@/lib/grading";
import type { ConceptOverrideInput, GradingBandsInput } from "@/lib/validation/grading";
import type { TenantContext } from "@/server/auth/tenant";
import type { TenantDb } from "@/server/tenant-db";

export class GradingError extends ApiError {
  declare readonly code: "NOT_FOUND" | "NOT_COMPLETED" | "NOT_IN_PROGRESS" | "SAME_CONCEPT";
  constructor(
    code: "NOT_FOUND" | "NOT_COMPLETED" | "NOT_IN_PROGRESS" | "SAME_CONCEPT",
    message: string,
  ) {
    super(code === "NOT_FOUND" ? 404 : 409, code, message);
    this.name = "GradingError";
  }
}

/** Faixas vigentes da instituição (padrão 50/70/90 se não configuradas). */
export async function getGradingBands(db: TenantDb): Promise<GradingBands> {
  const config = await db.tenantGradingConfig.findFirst({
    select: { edMinPercent: true, dMinPercent: true, pdMinPercent: true },
  });
  return config ?? { ...DEFAULT_GRADING_BANDS };
}

/** INSTITUTION_ADMIN: define as faixas (valide com gradingBandsSchema antes). */
export async function setGradingBands(ctx: TenantContext, bands: GradingBandsInput) {
  return ctx.db.tenantGradingConfig.upsert({
    where: { tenantId: ctx.tenantId },
    update: { ...bands, updatedById: ctx.user.id },
    create: { tenantId: ctx.tenantId, ...bands, updatedById: ctx.user.id },
  });
}

/**
 * Conclui a tentativa e calcula o conceito pelas faixas da instituição
 * (snapshot em gradingBands). Quem chama decide QUANDO concluir (cota atingida).
 */
export async function completeLevelAttempt(db: TenantDb, levelAttemptId: string) {
  const attempt = await db.levelAttempt.findFirst({
    where: { id: levelAttemptId },
    select: { id: true, status: true, correctCount: true, completedCount: true },
  });
  if (!attempt) throw new GradingError("NOT_FOUND", "Tentativa não encontrada");
  if (attempt.status !== "IN_PROGRESS") {
    throw new GradingError("NOT_IN_PROGRESS", "A tentativa não está em andamento");
  }
  const bands = await getGradingBands(db);
  const concept = computeConcept(attempt.correctCount, attempt.completedCount, bands);
  const now = new Date();
  return db.levelAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "COMPLETED",
      completedAt: now,
      gradedAt: now,
      computedConcept: concept,
      concept,
      gradingBands: { ...bands },
    },
  });
}

/**
 * PROFESSOR/INSTITUTION_ADMIN: ajusta o conceito final com justificativa
 * (valide com conceptOverrideSchema). Grava o estado atual na tentativa e um
 * registro imutável em concept_overrides. computedConcept nunca muda.
 */
export async function overrideLevelConcept(
  ctx: TenantContext,
  levelAttemptId: string,
  input: ConceptOverrideInput,
) {
  return ctx.db.$transaction(async (tx) => {
    const attempt = await tx.levelAttempt.findFirst({
      where: { id: levelAttemptId },
      select: { id: true, status: true, concept: true },
    });
    if (!attempt) throw new GradingError("NOT_FOUND", "Tentativa não encontrada");
    if (attempt.status !== "COMPLETED" || !attempt.concept) {
      throw new GradingError(
        "NOT_COMPLETED",
        "Só é possível ajustar o conceito de um nível concluído",
      );
    }
    if (attempt.concept === input.concept) {
      throw new GradingError("SAME_CONCEPT", "O conceito informado é igual ao atual");
    }
    const now = new Date();
    await tx.conceptOverride.create({
      data: {
        tenantId: ctx.tenantId, // tipos do Prisma exigem; a extensão confere
        levelAttemptId: attempt.id,
        fromConcept: attempt.concept,
        toConcept: input.concept,
        reason: input.reason,
        overriddenById: ctx.user.id,
      },
    });
    return tx.levelAttempt.update({
      where: { id: attempt.id },
      data: {
        concept: input.concept,
        overriddenById: ctx.user.id,
        overrideReason: input.reason,
        overriddenAt: now,
      },
    });
  });
}
