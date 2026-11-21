import { z } from "zod";

import { apiExpectedResultSchema, apiInitialSheetSchema } from "@/lib/validation/exercise-content";
import { gradingRulesSchema } from "@/lib/validation/grading-rules";
import {
  DIFFICULTIES,
  KNOWLEDGE_LEVELS,
  LEVEL_NOT_AVAILABLE_IN_MVP,
  MVP_LEVELS,
  PUBLICATION_STATUSES,
} from "@/lib/domain";

/**
 * Schemas de entrada para conjuntos, níveis e exercícios (BE2 usa nas APIs).
 * Nível: só MVP_LEVELS; DASHBOARD é recusado com mensagem clara (v1.1).
 */
export const mvpLevelSchema = z
  .enum(KNOWLEDGE_LEVELS, { error: "Nível inválido" })
  .refine(
    (level): level is (typeof MVP_LEVELS)[number] =>
      (MVP_LEVELS as readonly string[]).includes(level),
    { error: LEVEL_NOT_AVAILABLE_IN_MVP },
  );

export const difficultySchema = z.enum(DIFFICULTIES, { error: "Dificuldade inválida" });

/**
 * Conteúdo do exercício no formato combinado com BE2/FE1/FE2 (fonte em
 * ./exercise-content.ts): célula number|string|boolean|null|{ f: "=...", v? },
 * initialSheet = { cells: { A1: célula } }, gabarito com valor OU fórmula.
 */
export const initialSheetSchema = apiInitialSheetSchema;
export const expectedResultSchema = apiExpectedResultSchema;

export const exerciseInputSchema = z.object({
  title: z.string().trim().min(3).max(200),
  statement: z.string().trim().min(1).max(20_000),
  initialSheet: initialSheetSchema,
  expectedResult: expectedResultSchema,
  hint: z.string().trim().max(2_000).nullish(),
  gradingRules: gradingRulesSchema.nullish(),
  level: mvpLevelSchema,
  difficulty: difficultySchema,
  status: z.enum(PUBLICATION_STATUSES).optional(),
});
export const exerciseUpdateSchema = exerciseInputSchema.partial();

export const exerciseSetInputSchema = z.object({
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5_000).nullish(),
  /** Níveis participantes: pelo menos um (TA-014), sem DASHBOARD. */
  levels: z.array(mvpLevelSchema).min(1, { error: "Selecione pelo menos um nível" }),
  difficulties: z.array(difficultySchema).min(1, { error: "Selecione pelo menos uma dificuldade" }),
});
export const exerciseSetUpdateSchema = exerciseSetInputSchema.partial();

export const levelInputSchema = z.object({
  knowledgeLevel: mvpLevelSchema,
  position: z.number().int().min(0).optional(),
});

export type ExerciseInput = z.infer<typeof exerciseInputSchema>;
export type ExerciseSetInput = z.infer<typeof exerciseSetInputSchema>;
export type LevelInput = z.infer<typeof levelInputSchema>;
