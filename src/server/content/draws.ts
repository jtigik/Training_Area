import "server-only";

import { ApiError } from "@/lib/api-error";
import type { Difficulty, KnowledgeLevel } from "@/lib/domain";
import { drawFromPool } from "@/lib/pool";
import type { SetExerciseItem } from "@/lib/set-exercises";
import { livePool, poolItem, setExerciseItem } from "@/server/content/sets";
import type { TenantDb } from "@/server/tenant-db";

type Tx = Parameters<Parameters<TenantDb["$transaction"]>[0]>[0];
type Db = TenantDb | Tx;

/**
 * Sorteia `quantity` exercícios para a rodada e CONGELA em LevelAttemptExercise.
 * Conjunto publicado: só SetExercise do nível (dificuldades do conjunto).
 * Rascunho: pool vivo. Releituras usam listAttemptExercises (nunca re-sorteiam).
 */
export async function drawForLevelAttempt(
  tx: Tx,
  input: {
    tenantId: string;
    levelAttemptId: string;
    levelId: string;
    knowledgeLevel: KnowledgeLevel;
    setStatus: string;
    difficulties: readonly Difficulty[];
    quantity: number;
    random?: () => number;
  },
): Promise<SetExerciseItem[]> {
  const candidates: SetExerciseItem[] =
    input.setStatus === "PUBLISHED"
      ? (
          await tx.setExercise.findMany({
            where: { levelId: input.levelId, difficulty: { in: [...input.difficulties] } },
            select: { id: true, sourceExerciseId: true, position: true, snapshot: true },
            orderBy: { position: "asc" },
          })
        ).map(setExerciseItem)
      : (await livePool(tx, input.knowledgeLevel, input.difficulties)).map(poolItem);
  if (candidates.length === 0) {
    throw new ApiError(409, "EMPTY_POOL", "Este nível ainda não tem exercícios disponíveis");
  }
  const drawn = drawFromPool(candidates, input.quantity, input.random).map((item, position) => ({
    ...item,
    position,
  }));
  await tx.levelAttemptExercise.createMany({
    data: drawn.map((item) => ({
      tenantId: input.tenantId,
      levelAttemptId: input.levelAttemptId,
      position: item.position,
      exerciseId: item.ref.type === "exercise" ? item.ref.id : null,
      setExerciseId: item.ref.type === "setExercise" ? item.ref.id : null,
    })),
  });
  return drawn;
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
