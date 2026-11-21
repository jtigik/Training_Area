import "server-only";

import { ApiError } from "@/lib/api-error";
import type { Difficulty, KnowledgeLevel } from "@/lib/domain";
import { drawByDifficulty, type DifficultyShortfall } from "@/lib/pool";
import type { SetExerciseItem } from "@/lib/set-exercises";
import { livePool, poolItem, setExerciseItem } from "@/server/content/sets";
import type { TenantDb } from "@/server/tenant-db";

type Tx = Parameters<Parameters<TenantDb["$transaction"]>[0]>[0];
type Db = TenantDb | Tx;

/**
 * Sorteia a rodada POR DIFICULDADE (`quotas`, de resolveDifficultyQuotas) e
 * CONGELA em LevelAttemptExercise. Conjunto publicado: só SetExercise do nível
 * na versão ATUAL (`setVersion` = ExerciseSet.publishedVersion).
 * Rascunho (uso interno/testes; aluno só inicia publicado): pool vivo.
 * Falta no pool de uma dificuldade: sorteia o que houver e devolve `shortfalls`;
 * nada sorteado → 409 EMPTY_POOL (details.shortfalls).
 * Releituras usam listAttemptExercises (nunca re-sorteiam).
 */
export async function drawForLevelAttempt(
  tx: Tx,
  input: {
    tenantId: string;
    levelAttemptId: string;
    levelId: string;
    knowledgeLevel: KnowledgeLevel;
    setId: string;
    setStatus: string;
    setVersion: number;
    quotas: readonly { difficulty: Difficulty; quantity: number }[];
    random?: () => number;
  },
): Promise<{ drawn: SetExerciseItem[]; shortfalls: DifficultyShortfall[] }> {
  const difficulties = input.quotas.filter((q) => q.quantity > 0).map((q) => q.difficulty);
  const candidates: SetExerciseItem[] =
    input.setStatus === "PUBLISHED"
      ? (
          await tx.setExercise.findMany({
            where: {
              levelId: input.levelId,
              version: input.setVersion,
              difficulty: { in: difficulties },
            },
            select: { id: true, sourceExerciseId: true, position: true, snapshot: true },
            orderBy: { position: "asc" },
          })
        ).map(setExerciseItem)
      : (await livePool(tx, input.setId, input.knowledgeLevel, difficulties)).map(poolItem);
  const result = drawByDifficulty(candidates, input.quotas, input.random);
  if (result.drawn.length === 0) {
    throw new ApiError(409, "EMPTY_POOL", "Este nível ainda não tem exercícios disponíveis", {
      shortfalls: result.shortfalls,
    });
  }
  const drawn = result.drawn.map((item, position) => ({ ...item, position }));
  await tx.levelAttemptExercise.createMany({
    data: drawn.map((item) => ({
      tenantId: input.tenantId,
      levelAttemptId: input.levelAttemptId,
      position: item.position,
      exerciseId: item.ref.type === "exercise" ? item.ref.id : null,
      setExerciseId: item.ref.type === "setExercise" ? item.ref.id : null,
    })),
  });
  return { drawn, shortfalls: result.shortfalls };
}

/** Exercícios congelados da rodada, na ordem do sorteio (inclui gabarito: filtre para o aluno). */
export async function listAttemptExercises(
  db: Db,
  levelAttemptId: string,
): Promise<SetExerciseItem[]> {
  const rows = await db.levelAttemptExercise.findMany({
    where: { levelAttemptId },
    orderBy: { position: "asc" },
    select: {
      position: true,
      exercise: {
        select: {
          id: true,
          isGlobal: true,
          title: true,
          statement: true,
          initialSheet: true,
          expectedResult: true,
          gradingRules: true,
          hint: true,
          level: true,
          difficulty: true,
        },
      },
      setExercise: {
        select: { id: true, sourceExerciseId: true, position: true, snapshot: true },
      },
    },
  });
  return rows.map((r) =>
    r.setExercise
      ? { ...setExerciseItem(r.setExercise), position: r.position }
      : poolItem(r.exercise!, r.position),
  );
}
