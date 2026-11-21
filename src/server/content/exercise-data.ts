import { Prisma } from "@/generated/prisma/client";
import type { ExerciseInput } from "@/lib/validation/content";

const json = (v: unknown) => v as Prisma.InputJsonValue;

/**
 * Converte a entrada validada (exerciseInputSchema/exerciseUpdateSchema) nos
 * campos Json do Prisma. gradingRules: null limpa (DbNull), ausente mantém.
 */
export function toExerciseData<T extends Partial<ExerciseInput>>(input: T) {
  const { initialSheet, expectedResult, gradingRules, ...rest } = input;
  return {
    ...rest,
    ...(initialSheet !== undefined && { initialSheet: json(initialSheet) }),
    ...(expectedResult !== undefined && { expectedResult: json(expectedResult) }),
    ...(gradingRules !== undefined && {
      gradingRules: gradingRules === null ? Prisma.DbNull : json(gradingRules),
    }),
  } as Omit<T, "initialSheet" | "expectedResult" | "gradingRules"> & {
    initialSheet?: Prisma.InputJsonValue;
    expectedResult?: Prisma.InputJsonValue;
    gradingRules?: Prisma.InputJsonValue | typeof Prisma.DbNull;
  };
}
