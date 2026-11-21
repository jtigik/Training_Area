import { z } from "zod";

import { GRADE_CONCEPTS } from "@/lib/domain";
import { areValidGradingBands } from "@/lib/grading";

const percent = z.number().int({ error: "Use um número inteiro" }).min(1).max(100);

/**
 * Faixas de conceito (instituição em /api/admin/grading-config e padrão da
 * plataforma em /api/super-admin/grading-defaults). Regra do PO
 * "0 < ND < ED < D ≤ 100" — os três limites mapeados nos campos existentes:
 *   ND (fim do ND / início do ED) = edMinPercent
 *   ED (fim do ED / início do D)  = dMinPercent
 *   D  (fim do D  / início do PD) = pdMinPercent
 * ⇒ 0 < edMinPercent < dMinPercent < pdMinPercent ≤ 100. Falha → 422 VALIDATION_ERROR.
 */
export const gradingBandsSchema = z
  .object({ edMinPercent: percent, dMinPercent: percent, pdMinPercent: percent })
  .refine(areValidGradingBands, {
    error: "As faixas devem ser crescentes: 0 < edMinPercent < dMinPercent < pdMinPercent ≤ 100",
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
