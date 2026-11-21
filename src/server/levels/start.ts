import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { isMvpLevel, LEVEL_NOT_AVAILABLE_IN_MVP } from "@/lib/domain";
import { computeLevelUnlocks, type LevelUnlockState } from "@/lib/level-unlock";
import { resolveQuota } from "@/lib/quota";
import { toStudentItem } from "@/lib/set-exercises";
import type { TenantContext } from "@/server/auth/tenant";
import { drawForLevelAttempt } from "@/server/content/draws";
import type { TenantDb } from "@/server/tenant-db";

/** Cota quando nenhuma ExerciseQuota se aplica ao aluno. */
export const DEFAULT_LEVEL_QUOTA = 10;

type Tx = Parameters<Parameters<TenantDb["$transaction"]>[0]>[0];
type Db = TenantDb | Tx;

const START_ERRORS = {
  LOCKED: [409, "LEVEL_LOCKED", "Conclua o nível anterior com D ou PD para desbloquear este"],
  IN_PROGRESS: [409, "LEVEL_IN_PROGRESS", "Você já tem uma tentativa em andamento neste nível"],
  ALREADY_PASSED: [409, "LEVEL_ALREADY_PASSED", "Você já concluiu este nível com D ou PD"],
  AWAITING_GRADE: [409, "LEVEL_AWAITING_GRADE", "A última tentativa ainda aguarda o conceito"],
} as const;

/** Progresso do aluno em todos os níveis do conjunto (para a tela de trilha). */
export async function getSetProgress(
  db: Db,
  studentId: string,
  setId: string,
): Promise<LevelUnlockState[]> {
  const levels = await db.level.findMany({
    where: { setId },
    select: { id: true, knowledgeLevel: true },
  });
  if (levels.length === 0) {
    const exists = await db.exerciseSet.findFirst({ where: { id: setId }, select: { id: true } });
    if (!exists) throw new ApiError(404, "NOT_FOUND", "Conjunto não encontrado");
  }
  const attempts = await db.levelAttempt.findMany({
    where: { studentId, levelId: { in: levels.map((l) => l.id) } },
    select: { levelId: true, attemptNumber: true, status: true, concept: true },
  });
  return computeLevelUnlocks(
    levels.map((l) => ({
      levelId: l.id,
      knowledgeLevel: l.knowledgeLevel,
      attempts: attempts.filter((a) => a.levelId === l.id),
    })),
  );
}

/**
 * ALUNO inicia uma tentativa do nível: aplica o desbloqueio do conjunto e a
 * regra de refazer (ND/ED), resolve a cota, cria a LevelAttempt e congela o
 * sorteio (LevelAttemptExercise). Transação serializável.
 */
export async function startLevelAttempt(
  ctx: Pick<TenantContext, "db" | "tenantId" | "user">,
  levelId: string,
) {
  return ctx.db.$transaction(
    async (tx) => {
      const level = await tx.level.findFirst({
        where: { id: levelId },
        select: {
          id: true,
          setId: true,
          knowledgeLevel: true,
          set: { select: { status: true, difficulties: true } },
        },
      });
      if (!level) throw new ApiError(404, "NOT_FOUND", "Nível não encontrado");
      if (!isMvpLevel(level.knowledgeLevel)) {
        throw new ApiError(409, "LEVEL_NOT_AVAILABLE", LEVEL_NOT_AVAILABLE_IN_MVP);
      }

      const progress = await getSetProgress(tx, ctx.user.id, level.setId);
      const state = progress.find((p) => p.levelId === level.id)!;
      if (!state.start.allowed) {
        const [status, code, message] = START_ERRORS[state.start.reason];
        throw new ApiError(status, code, message, {
          requires: state.requires,
          lastConcept: state.lastConcept,
        });
      }

      const [quotas, memberships] = await Promise.all([
        tx.exerciseQuota.findMany({
          where: { levelId: level.id },
          select: { difficulty: true, classroomId: true, studentId: true, quantity: true },
        }),
        tx.classroomMember.findMany({
          where: { userId: ctx.user.id },
          select: { classroomId: true },
        }),
      ]);
      const quantity =
        resolveQuota(quotas, {
          studentId: ctx.user.id,
          classroomIds: memberships.map((m) => m.classroomId),
        }) ?? DEFAULT_LEVEL_QUOTA;

      const attempt = await tx.levelAttempt.create({
        data: {
          tenantId: ctx.tenantId,
          studentId: ctx.user.id,
          levelId: level.id,
          attemptNumber: state.start.attemptNumber,
        },
      });
      const drawn = await drawForLevelAttempt(tx, {
        tenantId: ctx.tenantId,
        levelAttemptId: attempt.id,
        levelId: level.id,
        knowledgeLevel: level.knowledgeLevel,
        setStatus: level.set.status,
        difficulties: level.set.difficulties,
        quantity,
      });
      const levelAttempt = await tx.levelAttempt.update({
        where: { id: attempt.id },
        data: { requiredCount: drawn.length },
      });
      return { levelAttempt, exercises: drawn.map(toStudentItem) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
