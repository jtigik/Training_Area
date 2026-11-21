import { z } from "zod";

import { GRADE_CONCEPTS } from "@/lib/domain";
import { areValidGradingBands } from "@/lib/grading";

const percent = z.number().int({ error: "Use um número inteiro" }).min(1).max(100);

/** Faixas de conceito da instituição (INSTITUTION_ADMIN). */
export const gradingBandsSchema = z
  .object({ edMinPercent: percent, dMinPercent: percent, pdMinPercent: percent })
  .refine(areValidGradingBands, {
    error: "As faixas devem ser crescentes: ED < D < PD (entre 1 e 100)",
  });

export const OVERRIDE_REASON_MIN_LENGTH = 10;

/** Ajuste manual do conceito pelo professor: justificativa obrigatória. */
export const conceptOverrideSchema = z.object({
  concept: z.enum(GRADE_CONCEPTS, { error: "Conceito inválido" }),
  reason: z
    .string({ error: "Informe a justificativa" })
    .trim()
    .min(OVERRIDE_REASON_MIN_LENGTH, {
      error: `A justificativa deve ter pelo menos ${OVERRIDE_REASON_MIN_LENGTH} caracteres`,
    })
    .max(2_000),
});

export type GradingBandsInput = z.infer<typeof gradingBandsSchema>;
export type ConceptOverrideInput = z.infer<typeof conceptOverrideSchema>;
