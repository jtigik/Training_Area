import "server-only";

import { ApiError } from "@/lib/api-error";
import type { GradeConcept } from "@/lib/domain";

import { computeConcept, DEFAULT_GRADING_BANDS, type GradingBands } from "@/lib/grading";
import type { ConceptOverrideInput, GradingBandsInput } from "@/lib/validation/grading";
import type { TenantContext } from "@/server/auth/tenant";
import { writeAudit } from "@/server/audit";
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
 * PROFESSOR: ajusta o conceito final com justificativa
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
    const override = await tx.conceptOverride.create({
      data: {
        tenantId: ctx.tenantId, // tipos do Prisma exigem; a extensão confere
        levelAttemptId: attempt.id,
        fromConcept: attempt.concept,
        toConcept: input.concept,
        reason: input.reason,
        overriddenById: ctx.user.id,
      },
      select: { id: true },
    });
    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.user.id,
      action: "level_attempt.concept_overridden",
      entityType: "LevelAttempt",
      entityId: attempt.id,
      data: {
        conceptOverrideId: override.id,
        from: attempt.concept,
        to: input.concept,
        reason: input.reason,
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

/** Item do histórico (contrato combinado com o FE2). */
export interface ConceptHistoryEntry {
  /** Conceito EFETIVO antes deste ajuste. */
  previousConcept: GradeConcept;
  /** Conceito definido por este ajuste. */
  concept: GradeConcept;
  /** Conceito calculado pelas faixas (não muda com ajustes). */
  computedConcept: GradeConcept | null;
  reason: string;
  /** Nulo só se o autor foi removido da plataforma. */
  adjustedBy: { id: string; name: string } | null;
  /** ISO 8601. */
  adjustedAt: string;
}

/**
 * Histórico COMPLETO de ajustes manuais do conceito de uma tentativa, do mais
 * antigo ao mais recente, a partir da trilha imutável concept_overrides (cada
 * ajuste também vai para AuditLog). Sem ajustes → { history: [] }.
 * Tentativa de outro tenant/inexistente → 404 NOT_FOUND.
 */
export async function getConceptHistory(
  db: TenantDb,
  levelAttemptId: string,
): Promise<{ history: ConceptHistoryEntry[] }> {
  const attempt = await db.levelAttempt.findFirst({
    where: { id: levelAttemptId },
    select: { id: true, computedConcept: true },
  });
  if (!attempt) throw new GradingError("NOT_FOUND", "Tentativa não encontrada");
  const rows = await db.conceptOverride.findMany({
    where: { levelAttemptId: attempt.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      fromConcept: true,
      toConcept: true,
      reason: true,
      createdAt: true,
      overriddenBy: { select: { id: true, name: true } },
    },
  });
  return {
    history: rows.map((r) => ({
      previousConcept: r.fromConcept,
      concept: r.toConcept,
      computedConcept: attempt.computedConcept,
      reason: r.reason,
      adjustedBy: r.overriddenBy,
      adjustedAt: r.createdAt.toISOString(),
    })),
  };
}
