import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import type { ExerciseInput } from "@/lib/validation/content";
import { prisma } from "@/server/db";

/**
 * Banco GLOBAL de exercícios (tenantId nulo, isGlobal) — escrita exclusiva do
 * SUPER_ADMIN, pelo cliente base. Instituições só leem (forTenant).
 */
const json = (v: unknown) => v as Prisma.InputJsonValue;

export function listGlobalExercises() {
  return prisma.exercise.findMany({
    where: { tenantId: null, isGlobal: true },
    orderBy: [{ level: "asc" }, { difficulty: "asc" }, { title: "asc" }],
  });
}

export function createGlobalExercise(authorId: string, input: ExerciseInput) {
  return prisma.exercise.create({
    data: {
      ...input,
      initialSheet: json(input.initialSheet),
      expectedResult: json(input.expectedResult),
      tenantId: null,
      isGlobal: true,
      authorId,
    },
  });
}

export async function updateGlobalExercise(id: string, input: Partial<ExerciseInput>) {
  const { initialSheet, expectedResult, ...rest } = input;
  const result = await prisma.exercise.updateMany({
    where: { id, tenantId: null, isGlobal: true },
    data: {
      ...rest,
      ...(initialSheet !== undefined && { initialSheet: json(initialSheet) }),
      ...(expectedResult !== undefined && { expectedResult: json(expectedResult) }),
    },
  });
  if (result.count === 0) throw new ApiError(404, "NOT_FOUND", "Exercício global não encontrado");
  return prisma.exercise.findUniqueOrThrow({ where: { id } });
}
