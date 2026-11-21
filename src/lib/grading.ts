import type { GradeConcept } from "./domain";

/** Conceitos que permitem refazer o nível. */
export const RETRYABLE_CONCEPTS: readonly GradeConcept[] = ["ND", "ED"];

export interface LevelAttemptSummary {
  attemptNumber: number;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  /** Conceito final gravado (ajuste do professor, se houver; senão o calculado). */
  concept: GradeConcept | null;
  /** Conceito calculado pelas faixas (fallback se `concept` ainda não foi gravado). */
  computedConcept?: GradeConcept | null;
}

/**
 * Conceito EFETIVO de uma tentativa (decisão do PO): o ajuste do professor, se
 * existir, senão o calculado. `concept` já guarda o ajustado (overrideLevelConcept)
 * ou o calculado (completeLevelAttempt); `computedConcept` é o fallback.
 * Cada tentativa tem o seu: uma nova tentativa nasce sem ajuste (não herda).
 */
export function effectiveConcept(
  attempt: Pick<LevelAttemptSummary, "concept" | "computedConcept">,
): GradeConcept | null {
  return attempt.concept ?? attempt.computedConcept ?? null;
}

const CONCEPT_RANK: Record<GradeConcept, number> = { ND: 0, ED: 1, D: 2, PD: 3 };

/** Melhor conceito efetivo entre as tentativas CONCLUÍDAS do nível (null se nenhuma). */
export function bestConcept(attempts: readonly LevelAttemptSummary[]): GradeConcept | null {
  let best: GradeConcept | null = null;
  for (const a of attempts) {
    if (a.status !== "COMPLETED") continue;
    const c = effectiveConcept(a);
    if (c !== null && (best === null || CONCEPT_RANK[c] > CONCEPT_RANK[best])) best = c;
  }
  return best;
}

export type StartLevelDecision =
  | { allowed: true; attemptNumber: number }
  | { allowed: false; reason: "IN_PROGRESS" | "ALREADY_PASSED" | "AWAITING_GRADE" };

/**
 * Pode iniciar uma (nova) tentativa do nível? Regra: a primeira sempre; depois,
 * só se a última concluída tem conceito EFETIVO ND ou ED. Abandonadas não contam.
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
  const concept = effectiveConcept(lastCompleted);
  if (concept === null) return { allowed: false, reason: "AWAITING_GRADE" };
  if (RETRYABLE_CONCEPTS.includes(concept)) {
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
