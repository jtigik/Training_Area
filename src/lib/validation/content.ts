import { z } from "zod";

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

const cellRef = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,3}[1-9][0-9]{0,6}$/, { error: "Célula inválida (ex.: B4)" });
const cellValue = z.union([z.string().max(10_000), z.number().finite(), z.boolean()]);

export const initialSheetSchema = z.object({
  cells: z.record(
    cellRef,
    z.object({
      value: cellValue.optional(),
      formula: z.string().startsWith("=").max(2_000).optional(),
      locked: z.boolean().optional(),
    }),
  ),
});

/** Gabarito: pelo menos uma célula, cada uma com valor ou fórmula (TA-016). */
export const expectedResultSchema = z
  .array(
    z
      .object({
        cell: cellRef,
        value: cellValue.optional(),
        formula: z.string().startsWith("=").max(2_000).optional(),
        tolerance: z.number().nonnegative().optional(),
      })
      .refine((c) => c.value !== undefined || c.formula !== undefined, {
        error: "Informe valor ou fórmula esperada",
      }),
  )
  .min(1, { error: "Informe pelo menos uma célula de gabarito" });

export const exerciseInputSchema = z.object({
  title: z.string().trim().min(3).max(200),
  statement: z.string().trim().min(1).max(20_000),
  initialSheet: initialSheetSchema,
  expectedResult: expectedResultSchema,
  hint: z.string().trim().max(2_000).nullish(),
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
