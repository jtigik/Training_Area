import { z } from "zod";

/**
 * FONTE COMPARTILHADA do formato de conteúdo de exercício na API (combinado
 * Backend 1 × Backend 2 × FE1 × FE2). Copiado de
 * wt-backend2/src/server/exercises/schemas.ts @ 66cfc0f (bloco "API cell format"
 * + regras do motor); o Backend 2 deve passar a importar daqui.
 *
 * Célula: number | string | boolean | null | { f: "=...", v? }.
 *   Fórmula só dentro de `{ f }`; string comum começando com "=" é texto literal.
 * initialSheet:  { cells: { A1: cell } }
 * expectedResult: [{ cell, value | formula (um dos dois), tolerance? }]
 * gradingRules:   { rules?: GradingRuleOptions, targets?: { A1: GradingRuleOptions } }
 */

const a1 = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,3}[1-9]\d{0,6}$/, { error: "Célula inválida (ex.: B4)" });

const apiScalar = z.union([z.number().finite(), z.string().max(10_000), z.boolean(), z.null()]);

export const apiCellValueSchema = z.union([
  apiScalar,
  z.object({ f: z.string().trim().min(1).max(2000), v: apiScalar.optional() }).strict(),
]);

export const apiInitialSheetSchema = z.object({ cells: z.record(a1, apiCellValueSchema) });

const expectedValue = z.union([
  z.number().finite(),
  z.string().max(10_000),
  z.boolean(),
  z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/) }),
]);

export const apiExpectedResultSchema = z
  .array(
    z
      .object({
        cell: a1,
        value: expectedValue.optional(),
        formula: z.string().trim().startsWith("=").max(2000).optional(),
        tolerance: z.number().nonnegative().optional(),
      })
      .strict()
      .refine((c) => (c.value === undefined) !== (c.formula === undefined), {
        error: "Informe valor ou fórmula esperada (um dos dois)",
      }),
  )
  .min(1, { error: "Informe pelo menos uma célula de gabarito" })
  .max(50);

const functionList = z.array(z.string().trim().min(1).max(64)).max(20);

/** Opções do motor de correção (Backend 2), por exercício (`rules`) ou por célula (`targets`). */
export const gradingRuleOptionsSchema = z
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
  .strict()
  .refine(
    (r) =>
      !r.requiredFunctions ||
      !r.forbiddenFunctions ||
      !r.requiredFunctions.some((f) =>
        r.forbiddenFunctions!.some((g) => g.toUpperCase() === f.toUpperCase()),
      ),
    { error: "Uma função não pode ser exigida e proibida ao mesmo tempo" },
  );

export const apiGradingRulesSchema = z
  .object({
    rules: gradingRuleOptionsSchema.optional(),
    targets: z.record(a1, gradingRuleOptionsSchema).optional(),
  })
  .strict();

export type ApiCellValue = z.infer<typeof apiCellValueSchema>;
export type ApiInitialSheet = z.infer<typeof apiInitialSheetSchema>;
export type ApiExpectedResult = z.infer<typeof apiExpectedResultSchema>;
export type GradingRuleOptions = z.infer<typeof gradingRuleOptionsSchema>;
export type ApiGradingRules = z.infer<typeof apiGradingRulesSchema>;
