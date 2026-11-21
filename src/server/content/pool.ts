import "server-only";

import type { Difficulty } from "@/lib/domain";
import { levelPoolWhere } from "@/lib/pool";
import type { TenantDb } from "@/server/tenant-db";

/** Exercícios elegíveis para um nível (tenant + globais). null se o nível não existe no tenant. */
export async function listLevelPool(db: TenantDb, levelId: string, difficulty?: Difficulty | null) {
  const level = await db.level.findFirst({
    where: { id: levelId },
    select: { knowledgeLevel: true, set: { select: { difficulties: true } } },
  });
  if (!level) return null;
  return db.exercise.findMany({
    where: levelPoolWhere(level.knowledgeLevel, level.set.difficulties, difficulty),
    select: { id: true, title: true, level: true, difficulty: true, isGlobal: true },
    orderBy: { id: "asc" },
  });
}
