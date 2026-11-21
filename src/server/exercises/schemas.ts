import { z } from "zod";

import { DIFFICULTIES, MVP_LEVELS, PUBLICATION_STATUSES } from "@/server/domain";

const cellInput = z.union([z.number().finite(), z.string().max(10_000), z.boolean(), z.null()]);

const expectedValue = z.union([
  z.number().finite(),
  z.string().max(10_000),
  z.boolean(),
  z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/) }),
]);

const expectedAnswer = z.union([
  z.object({ value: expectedValue }).strict(),
  z.object({ formula: z.string().trim().startsWith("=").max(2000) }).strict(),
]);

const functionList = z.array(z.string().trim().min(1).max(64)).max(20);

export const gradingRulesSchema = z
  .object({
    numberTolerance: z.number().min(0).max(1e6).optional(),
    relativeTolerance: z.number().min(0).max(1).optional(),
    caseInsensitive: z.boolean().optional(),
    trimStrings: z.boolean().optional(),
    requiredFunctions: functionList.optional(),
    requiredFunctionsMode: z.enum(["all", "any"]).optional(),
    forbiddenFunctions: functionList.optional(),
    allowConstants: z.boolean().optional(),
    requireCellReference: z.boolean().optional(),
    forbidLiteralExpectedValue: z.boolean().optional(),
    sensitivityCheck: z.boolean().optional(),
    allowVolatileFunctions: z.boolean().optional(),
  })
  .strict();

export const exerciseContentSchema = z.object({
  sheet: z.union([
    z.array(z.array(cellInput).max(100)).max(1000),
    z.record(z.string().regex(/^\$?[A-Za-z]{1,3}\$?\d{1,7}$/), cellInput),
  ]),
  targets: z
    .array(
      gradingRulesSchema.extend({
        cell: z.string().regex(/^\$?[A-Za-z]{1,3}\$?\d{1,7}$/),
        expected: expectedAnswer,
      }),
    )
    .min(1)
    .max(50),
  rules: gradingRulesSchema.optional(),
});

export const createExerciseSchema = z.object({
  setId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  statement: z.string().trim().min(1).max(20_000),
  hint: z.string().trim().max(2000).nullish(),
  level: z.enum(MVP_LEVELS),
  difficulty: z.enum(DIFFICULTIES),
  position: z.number().int().min(0).optional(),
  content: exerciseContentSchema,
});

export const updateExerciseSchema = createExerciseSchema
  .omit({ setId: true })
  .partial()
  .extend({ status: z.enum(PUBLICATION_STATUSES).optional() });

export const submissionSchema = z.object({
  exerciseId: z.string().min(1),
  submission: z.record(z.string(), z.string().max(2000)),
  clientIsCorrect: z.boolean().nullish(),
  levelCycle: z.number().int().min(1).default(1),
});

export type CreateExerciseInput = z.input<typeof createExerciseSchema>;
export type UpdateExerciseInput = z.input<typeof updateExerciseSchema>;
export type SubmissionInput = z.input<typeof submissionSchema>;
