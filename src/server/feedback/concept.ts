import { z } from "zod";

/**
 * Level concept (conceito):
 *   ND — Não demonstrado · ED — Em desenvolvimento · D — Demonstrado · PD — Plenamente demonstrado
 * The student may redo a level when the concept is ND or ED (product rule, not configurable);
 * the teacher configures thresholds, the basis metric and an optional retry cap per level.
 */
export const CONCEPTS = ["ND", "ED", "D", "PD"] as const;
export type Concept = (typeof CONCEPTS)[number];

export const CONCEPT_LABELS_PT_BR: Record<Concept, string> = {
  ND: "Não demonstrado",
  ED: "Em desenvolvimento",
  D: "Demonstrado",
  PD: "Plenamente demonstrado",
};

/** Concepts that allow redoing the level. */
export const RETRYABLE_CONCEPTS: readonly Concept[] = ["ND", "ED"];

export const conceptRulesSchema = z
  .object({
    /**
     * accuracy: exercises correct (any attempt) / required exercises.
     * firstAttempt: exercises correct on the first attempt / required exercises.
     */
    basis: z.enum(["accuracy", "firstAttempt"]),
    /** Minimum percentage (inclusive) to reach each concept; below ED is ND. */
    thresholds: z.object({
      ED: z.number().min(0).max(100),
      D: z.number().min(0).max(100),
      PD: z.number().min(0).max(100),
    }),
    /** Maximum number of retries of the level (null = unlimited). */
    maxRetries: z.number().int().min(0).max(100).nullable(),
  })
  .refine((r) => r.thresholds.ED <= r.thresholds.D && r.thresholds.D <= r.thresholds.PD, {
    message: "Thresholds must satisfy ED <= D <= PD",
    path: ["thresholds"],
  });

export type ConceptRules = z.infer<typeof conceptRulesSchema>;

/** Platform defaults: ND < 50% ≤ ED < 70% ≤ D < 90% ≤ PD, on overall accuracy, unlimited retries. */
export const DEFAULT_CONCEPT_RULES: ConceptRules = {
  basis: "accuracy",
  thresholds: { ED: 50, D: 70, PD: 90 },
  maxRetries: null,
};

/** Merges teacher overrides with defaults and validates; throws ZodError on invalid rules. */
export function resolveConceptRules(overrides?: Partial<ConceptRules> | null): ConceptRules {
  return conceptRulesSchema.parse({
    ...DEFAULT_CONCEPT_RULES,
    ...overrides,
    thresholds: { ...DEFAULT_CONCEPT_RULES.thresholds, ...overrides?.thresholds },
  });
}

export interface ConceptInput {
  requiredCount: number;
  exercisesCorrect: number;
  firstAttemptCorrect: number;
}

export interface ConceptResult {
  concept: Concept;
  /** Percentage used for the decision, 0–100, one decimal. */
  percent: number;
  basis: ConceptRules["basis"];
}

export function computeConcept(
  input: ConceptInput,
  rules: ConceptRules = DEFAULT_CONCEPT_RULES,
): ConceptResult {
  const den = Math.max(1, input.requiredCount);
  const num = rules.basis === "firstAttempt" ? input.firstAttemptCorrect : input.exercisesCorrect;
  const percent = Math.round(Math.min(100, Math.max(0, (num / den) * 100)) * 10) / 10;
  const t = rules.thresholds;
  const concept: Concept =
    percent >= t.PD ? "PD" : percent >= t.D ? "D" : percent >= t.ED ? "ED" : "ND";
  return { concept, percent, basis: rules.basis };
}

export interface RetryEligibility {
  allowed: boolean;
  reason: "CONCEPT_NOT_RETRYABLE" | "MAX_RETRIES_REACHED" | null;
  retriesUsed: number;
  retriesLeft: number | null;
}

/**
 * Whether the student may redo the level. `levelCycle` is the cycle just finished
 * (1 = first run, so retriesUsed = levelCycle - 1).
 */
export function canRetryLevel(
  concept: Concept,
  levelCycle: number,
  rules: ConceptRules = DEFAULT_CONCEPT_RULES,
): RetryEligibility {
  const retriesUsed = Math.max(0, levelCycle - 1);
  const retriesLeft =
    rules.maxRetries === null ? null : Math.max(0, rules.maxRetries - retriesUsed);
  if (!RETRYABLE_CONCEPTS.includes(concept)) {
    return { allowed: false, reason: "CONCEPT_NOT_RETRYABLE", retriesUsed, retriesLeft };
  }
  if (retriesLeft === 0)
    return { allowed: false, reason: "MAX_RETRIES_REACHED", retriesUsed, retriesLeft };
  return { allowed: true, reason: null, retriesUsed, retriesLeft };
}
