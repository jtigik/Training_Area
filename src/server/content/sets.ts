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
 * - POOL do conjunto = exercícios VINCULADOS (SetPoolExercise; ver pool-links.ts),
 *   filtrados por PUBLICADO, nível do Level e dificuldades do conjunto.
 * - RASCUNHO: lista/sorteia desse pool vivo.
 * - PUBLICADO: publishSet congela o pool numa NOVA versão de SetExercise
 *   (ExerciseSet.publishedVersion); novos sorteios usam a versão atual e rodadas
 *   em curso mantêm a sua. SetExercises nunca são apagados (tentativas os referenciam).
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

/** Candidatos do pool vivo (vinculados ao conjunto) para um nível. */
export function livePool(
  db: Db,
  setId: string,
  level: KnowledgeLevel,
  difficulties: readonly Difficulty[],
) {
  return db.exercise.findMany({
    where: { ...levelPoolWhere(level, difficulties), setLinks: { some: { setId } } },
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
      publishedVersion: true,
      levels: { select: { id: true, knowledgeLevel: true, position: true } },
    },
  });
  if (!set) throw new ApiError(404, "NOT_FOUND", "Conjunto não encontrado");
  return { ...set, levels: set.levels.filter((l) => isMvpLevel(l.knowledgeLevel)) };
}

export interface SetExercisesView {
  set: { id: string; status: string; publishedAt: Date | null; publishedVersion: number };
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
                where: { setId, levelId: level.id, version: set.publishedVersion },
                select: { id: true, sourceExerciseId: true, position: true, snapshot: true },
                orderBy: { position: "asc" },
              })
            ).map(setExerciseItem)
          : (await livePool(db, setId, level.knowledgeLevel, set.difficulties)).map(poolItem);
        return { levelId: level.id, knowledgeLevel: level.knowledgeLevel, exercises };
      }),
  );
  return {
    set: {
      id: set.id,
      status: set.status,
      publishedAt: set.publishedAt,
      publishedVersion: set.publishedVersion,
    },
    source: published ? "snapshot" : "pool",
    levels,
  };
}

/**
 * Publica (ou REPUBLICA, se já foi publicado e voltou a rascunho) o conjunto:
 * congela o pool vinculado de cada nível numa nova versão de SetExercise
 * (publishedVersion + 1) e marca PUBLISHED. Versões anteriores ficam intactas
 * (rodadas em curso continuam nelas). 409 ALREADY_PUBLISHED se já está
 * PUBLICADO; 409 EMPTY_POOL (details: níveis sem exercício); 409 NO_LEVELS.
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
        rows: await livePool(tx, setId, level.knowledgeLevel, set.difficulties),
      })),
    );
    const empty = pools.filter((p) => p.rows.length === 0).map((p) => p.level.knowledgeLevel);
    if (empty.length > 0) {
      throw new ApiError(409, "EMPTY_POOL", "Há níveis sem exercícios publicados elegíveis", {
        levels: empty,
      });
    }
    const version = set.publishedVersion + 1;
    const data = pools.flatMap(({ level, rows }) =>
      rows.map((row, position) => ({
        tenantId,
        setId,
        version,
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
      data: { status: "PUBLISHED", publishedAt, publishedVersion: version },
    });
    return {
      setId,
      publishedAt,
      version,
      levels: pools.map((p) => ({ levelId: p.level.id, count: p.rows.length })),
    };
  });
}

/**
 * Despublica: só muda o status para DRAFT (snapshots e tentativas ficam intactos).
 * Republicar depois cria uma nova versão. 409 NOT_PUBLISHED se não está publicado.
 */
export async function unpublishSet(db: TenantDb, setId: string) {
  const set = await loadSet(db, setId);
  if (set.status !== "PUBLISHED") {
    throw new ApiError(409, "NOT_PUBLISHED", "O conjunto não está publicado");
  }
  return db.exerciseSet.update({
    where: { id: setId },
    data: { status: "DRAFT" },
    select: { id: true, status: true, publishedAt: true, publishedVersion: true },
  });
}
