import "server-only";

import { ApiError } from "@/lib/api-error";
import type { TenantDb } from "@/server/tenant-db";

/**
 * Vínculo conjunto ↔ exercício (SetPoolExercise). O pool do conjunto são os
 * exercícios vinculados, filtrados por PUBLICADO + nível + dificuldade na hora de
 * listar/sortear/publicar. O exercício pode ser da instituição ou global.
 * Vincular é idempotente; mudar o pool de um conjunto PUBLICADO só vale na próxima
 * publicação (o snapshot atual não muda).
 */
async function assertSet(db: TenantDb, setId: string) {
  const set = await db.exerciseSet.findFirst({ where: { id: setId }, select: { id: true } });
  if (!set) throw new ApiError(404, "NOT_FOUND", "Conjunto não encontrado");
}

export async function linkExercisesToSet(
  db: TenantDb,
  tenantId: string,
  setId: string,
  exerciseIds: readonly string[],
) {
  await assertSet(db, setId);
  const ids = [...new Set(exerciseIds)];
  // forTenant: exercícios da instituição ou globais; de outra instituição = não encontrado.
  const found = await db.exercise.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const missing = ids.filter((id) => !found.some((e) => e.id === id));
  if (missing.length > 0) {
    throw new ApiError(404, "EXERCISE_NOT_FOUND", "Exercício não encontrado", { missing });
  }
  const { count } = await db.setPoolExercise.createMany({
    data: ids.map((exerciseId) => ({ tenantId, setId, exerciseId })),
    skipDuplicates: true,
  });
  return { linked: count };
}

export async function unlinkExercisesFromSet(
  db: TenantDb,
  setId: string,
  exerciseIds: readonly string[],
) {
  await assertSet(db, setId);
  const { count } = await db.setPoolExercise.deleteMany({
    where: { setId, exerciseId: { in: [...exerciseIds] } },
  });
  return { unlinked: count };
}

/** Exercícios vinculados ao conjunto (qualquer status; o filtro de pool é aplicado ao sortear). */
export async function listSetPoolLinks(db: TenantDb, setId: string) {
  await assertSet(db, setId);
  const links = await db.setPoolExercise.findMany({
    where: { setId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      exerciseId: true,
      createdAt: true,
      exercise: {
        select: {
          id: true,
          title: true,
          level: true,
          difficulty: true,
          status: true,
          isGlobal: true,
        },
      },
    },
  });
  return links.map((l) => ({ ...l.exercise, linkedAt: l.createdAt }));
}
