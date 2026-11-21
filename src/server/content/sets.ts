import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { isMvpLevel, type Difficulty, type KnowledgeLevel } from "@/lib/domain";
import { levelPoolWhere } from "@/lib/pool";
import {
  snapshotFromExercise,
  type SetExerciseItem,
  type SetExerciseSnapshot,
} from "@/lib/set-exercises";
import type { TenantDb } from "@/server/tenant-db";

/**
 * Conjunto × exercícios (decisão do PO, pedido do BE2):
 * - RASCUNHO: exercícios vêm do pool vivo (tenant + globais PUBLICADOS, nível do
 *   Level e dificuldades do conjunto).
 * - PUBLICADO: publishSet copia o pool elegível para SetExercise (snapshot) e o
 *   conjunto passa a sortear SÓ daí; edições posteriores no banco não o afetam.
 */
type Tx = Parameters<Parameters<TenantDb["$transaction"]>[0]>[0];
type Db = TenantDb | Tx;

const EXERCISE_SELECT = {
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
} as const;

const POOL_ORDER = [{ difficulty: "asc" }, { title: "asc" }, { id: "asc" }] as const;

type PoolRow = Prisma.ExerciseGetPayload<{ select: typeof EXERCISE_SELECT }>;
type SetExerciseRow = {
  id: string;
  sourceExerciseId: string | null;
  position: number;
  snapshot: unknown;
};

export function poolItem(row: PoolRow, position: number): SetExerciseItem {
  return {
    ref: { type: "exercise", id: row.id },
    sourceExerciseId: row.id,
    isGlobal: row.isGlobal,
    position,
    ...snapshotFromExercise(row),
  };
}

export function setExerciseItem(row: SetExerciseRow): SetExerciseItem {
  return {
    ref: { type: "setExercise", id: row.id },
    sourceExerciseId: row.sourceExerciseId,
    isGlobal: null,
    position: row.position,
    ...(row.snapshot as SetExerciseSnapshot),
  };
}

/** Candidatos do pool vivo para um nível (rascunho). */
export function livePool(db: Db, level: KnowledgeLevel, difficulties: readonly Difficulty[]) {
  return db.exercise.findMany({
    where: levelPoolWhere(level, difficulties),
    select: EXERCISE_SELECT,
    orderBy: [...POOL_ORDER],
  });
}

async function loadSet(db: Db, setId: string) {
  const set = await db.exerciseSet.findFirst({
    where: { id: setId },
    select: {
      id: true,
      status: true,
      difficulties: true,
      publishedAt: true,
      levels: { select: { id: true, knowledgeLevel: true, position: true } },
    },
  });
  if (!set) throw new ApiError(404, "NOT_FOUND", "Conjunto não encontrado");
  return { ...set, levels: set.levels.filter((l) => isMvpLevel(l.knowledgeLevel)) };
}

export interface SetExercisesView {
  set: { id: string; status: string; publishedAt: Date | null };
  /** "pool" (rascunho, vivo) ou "snapshot" (publicado, congelado). */
  source: "pool" | "snapshot";
  levels: { levelId: string; knowledgeLevel: KnowledgeLevel; exercises: SetExerciseItem[] }[];
}

/** Serve /sets/:id/exercises nos dois estados (inclui gabarito: uso do professor). */
export async function listSetExercises(db: Db, setId: string): Promise<SetExercisesView> {
  const set = await loadSet(db, setId);
  const published = set.status === "PUBLISHED";
  const levels = await Promise.all(
    set.levels
      .sort((a, b) => a.position - b.position)
      .map(async (level) => {
        const exercises = published
          ? (
              await db.setExercise.findMany({
                where: { setId, levelId: level.id },
                select: { id: true, sourceExerciseId: true, position: true, snapshot: true },
                orderBy: { position: "asc" },
              })
            ).map(setExerciseItem)
          : (await livePool(db, level.knowledgeLevel, set.difficulties)).map(poolItem);
        return { levelId: level.id, knowledgeLevel: level.knowledgeLevel, exercises };
      }),
  );
  return {
    set: { id: set.id, status: set.status, publishedAt: set.publishedAt },
    source: published ? "snapshot" : "pool",
    levels,
  };
}

/**
 * Publica o conjunto: copia o pool elegível de cada nível para SetExercise e
 * marca PUBLISHED. 409 ALREADY_PUBLISHED; 409 EMPTY_POOL (details: níveis sem
 * exercício); 409 NO_LEVELS.
 */
export async function publishSet(db: TenantDb, tenantId: string, setId: string) {
  return db.$transaction(async (tx) => {
    const set = await loadSet(tx, setId);
    if (set.status === "PUBLISHED") {
      throw new ApiError(409, "ALREADY_PUBLISHED", "O conjunto já está publicado");
    }
    if (set.levels.length === 0) {
      throw new ApiError(409, "NO_LEVELS", "O conjunto não tem níveis do MVP");
    }
    const pools = await Promise.all(
      set.levels.map(async (level) => ({
        level,
        rows: await livePool(tx, level.knowledgeLevel, set.difficulties),
      })),
    );
    const empty = pools.filter((p) => p.rows.length === 0).map((p) => p.level.knowledgeLevel);
    if (empty.length > 0) {
      throw new ApiError(409, "EMPTY_POOL", "Há níveis sem exercícios publicados elegíveis", {
        levels: empty,
      });
    }
    await tx.setExercise.deleteMany({ where: { setId } });
    const data = pools.flatMap(({ level, rows }) =>
      rows.map((row, position) => ({
        tenantId,
        setId,
        levelId: level.id,
        sourceExerciseId: row.id,
        position,
        level: row.level,
        difficulty: row.difficulty,
        snapshot: snapshotFromExercise(row) as unknown as Prisma.InputJsonValue,
      })),
    );
    await tx.setExercise.createMany({ data });
    const publishedAt = new Date();
    await tx.exerciseSet.update({
      where: { id: setId },
      data: { status: "PUBLISHED", publishedAt },
    });
    return {
      setId,
      publishedAt,
      levels: pools.map((p) => ({ levelId: p.level.id, count: p.rows.length })),
    };
  });
}
