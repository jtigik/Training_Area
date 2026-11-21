import type { GradeConcept } from "./domain";

/** Conceitos que permitem refazer o nível. */
export const RETRYABLE_CONCEPTS: readonly GradeConcept[] = ["ND", "ED"];

export interface LevelAttemptSummary {
  attemptNumber: number;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  concept: GradeConcept | null;
}

export type StartLevelDecision =
  | { allowed: true; attemptNumber: number }
  | { allowed: false; reason: "IN_PROGRESS" | "ALREADY_PASSED" | "AWAITING_GRADE" };

/**
 * Pode iniciar uma (nova) tentativa do nível? Regra: a primeira sempre; depois,
 * só se a última concluída tirou ND ou ED. Abandonadas não contam como nota.
 */
export function decideStartLevel(previous: readonly LevelAttemptSummary[]): StartLevelDecision {
  if (previous.some((a) => a.status === "IN_PROGRESS")) {
    return { allowed: false, reason: "IN_PROGRESS" };
  }
  const nextNumber = previous.reduce((max, a) => Math.max(max, a.attemptNumber), 0) + 1;
  const lastCompleted = [...previous]
    .filter((a) => a.status === "COMPLETED")
    .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];

  if (!lastCompleted) return { allowed: true, attemptNumber: nextNumber };
  if (lastCompleted.concept === null) return { allowed: false, reason: "AWAITING_GRADE" };
  if (RETRYABLE_CONCEPTS.includes(lastCompleted.concept)) {
    return { allowed: true, attemptNumber: nextNumber };
  }
  return { allowed: false, reason: "ALREADY_PASSED" };
}

export function canRetryLevel(concept: GradeConcept | null): boolean {
  return concept !== null && RETRYABLE_CONCEPTS.includes(concept);
}
