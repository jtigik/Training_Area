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

// ---------------------------------------------------------------------------
// Cálculo automático do conceito (PO, Sprint 1)
// ---------------------------------------------------------------------------

/**
 * Percentual MÍNIMO (inclusivo) de acerto para cada conceito; abaixo de
 * edMinPercent é ND. Padrão: ND < 50 <= ED < 70 <= D < 90 <= PD.
 */
export interface GradingBands {
  edMinPercent: number;
  dMinPercent: number;
  pdMinPercent: number;
}

export const DEFAULT_GRADING_BANDS: Readonly<GradingBands> = Object.freeze({
  edMinPercent: 50,
  dMinPercent: 70,
  pdMinPercent: 90,
});

export function areValidGradingBands(b: GradingBands): boolean {
  return (
    [b.edMinPercent, b.dMinPercent, b.pdMinPercent].every(Number.isInteger) &&
    0 < b.edMinPercent &&
    b.edMinPercent < b.dMinPercent &&
    b.dMinPercent < b.pdMinPercent &&
    b.pdMinPercent <= 100
  );
}

/** Taxa de acerto em % (0–100). Sem exercícios feitos = 0. */
export function accuracyPercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return (Math.min(Math.max(correct, 0), total) / total) * 100;
}

/** Conceito pela taxa de acerto. Ex. (padrão): 69,9% → ED; 70% → D; 90% → PD. */
export function computeConcept(
  correct: number,
  total: number,
  bands: GradingBands = DEFAULT_GRADING_BANDS,
): GradeConcept {
  const pct = accuracyPercent(correct, total);
  if (pct >= bands.pdMinPercent) return "PD";
  if (pct >= bands.dMinPercent) return "D";
  if (pct >= bands.edMinPercent) return "ED";
  return "ND";
}
