import { z } from "zod";

/**
 * Regras extras de correção de um exercício (Exercise.gradingRules, copiadas no
 * snapshot de SetExercise). Todas opcionais; o motor (BE2) aplica as presentes.
 * Extensível: chaves desconhecidas são preservadas (looseObject) para versões
 * futuras do motor — valide o que conhece, não descarte o resto.
 */
const fnName = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9._]{0,63}$/, { error: "Nome de função inválido (ex.: PROCV)" });

export const gradingRulesSchema = z
  .looseObject({
    /** Versão do formato (para migrações futuras). */
    version: z.literal(1).default(1),
    /** Funções que a fórmula DEVE usar (ex.: ["SOMA"]). */
    requiredFunctions: z.array(fnName).max(20).optional(),
    /** Funções proibidas (ex.: ["SOMASE"] quando o objetivo é usar SE). */
    forbiddenFunctions: z.array(fnName).max(20).optional(),
    /** Tolerância numérica absoluta padrão (sobrescrita por célula no gabarito). */
    tolerance: z.number().nonnegative().max(1e9).optional(),
    /** Comparação de textos sensível a maiúsculas/minúsculas (padrão false). */
    caseSensitive: z.boolean().optional(),
    /** Ignorar espaços nas pontas de textos (padrão true). */
    trimWhitespace: z.boolean().optional(),
    /** Funções voláteis aceitas/tratadas (ex.: ["HOJE", "AGORA", "ALEATORIO"]). */
    volatileFunctions: z.array(fnName).max(20).optional(),
    /** Exigir fórmula (não aceitar valor digitado) nas células do gabarito. */
    requireFormula: z.boolean().optional(),
    /** Separador de argumentos esperado na fórmula exibida (pt-BR usa ";"). */
    argumentSeparator: z.enum([";", ","]).optional(),
  })
  .refine(
    (r) =>
      !r.requiredFunctions ||
      !r.forbiddenFunctions ||
      !r.requiredFunctions.some((f) => r.forbiddenFunctions!.includes(f)),
    { error: "Uma função não pode ser exigida e proibida ao mesmo tempo" },
  );

export type GradingRules = z.infer<typeof gradingRulesSchema>;
