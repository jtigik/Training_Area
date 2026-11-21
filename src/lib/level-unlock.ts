import { isMvpLevel, MVP_LEVELS, type GradeConcept, type KnowledgeLevel } from "@/lib/domain";
import {
  bestConcept,
  decideStartLevel,
  effectiveConcept,
  type LevelAttemptSummary,
  type StartLevelDecision,
} from "@/lib/grading";

/**
 * Desbloqueio de níveis num ExerciseSet (decisão do PO):
 *   Fundamental → Profissional → Avançado (DASHBOARD é ignorado no MVP).
 * - O PRIMEIRO nível existente no conjunto já começa desbloqueado.
 * - O próximo nível existente desbloqueia quando o MELHOR conceito EFETIVO
 *   (ajuste do professor, se houver, senão o calculado) do anterior é D ou PD.
 *   ND/ED na última tentativa permitem refazer o nível.
 * - Níveis ausentes no conjunto são pulados (ex.: só Fundamental e Avançado →
 *   Avançado depende do Fundamental).
 */
export const UNLOCK_ORDER: readonly KnowledgeLevel[] = MVP_LEVELS;
export const PASSING_CONCEPTS: readonly GradeConcept[] = ["D", "PD"];

export interface SetLevelProgressInput {
  levelId: string;
  knowledgeLevel: KnowledgeLevel;
  attempts: readonly LevelAttemptSummary[];
}

export interface LevelUnlockState {
  levelId: string;
  knowledgeLevel: KnowledgeLevel;
  unlocked: boolean;
  /** Conceito efetivo da última tentativa concluída (null se nenhuma). */
  lastConcept: GradeConcept | null;
  /** Melhor conceito efetivo entre as tentativas concluídas (null se nenhuma). */
  bestConcept: GradeConcept | null;
  /** bestConcept é D ou PD (libera o próximo nível). */
  passed: boolean;
  /** Nível que precisa de D/PD para liberar este (null se é o primeiro). */
  requires: KnowledgeLevel | null;
  /** Pode iniciar uma tentativa agora? (desbloqueado + regra de refazer) */
  start: StartLevelDecision | { allowed: false; reason: "LOCKED" };
}

export function lastCompletedConcept(
  attempts: readonly LevelAttemptSummary[],
): GradeConcept | null {
  const last = attempts
    .filter((a) => a.status === "COMPLETED")
    .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
  return last ? effectiveConcept(last) : null;
}

export function isPassing(concept: GradeConcept | null): boolean {
  return concept !== null && PASSING_CONCEPTS.includes(concept);
}

/** Estado de cada nível do MVP existente no conjunto, na ordem de desbloqueio. */
export function computeLevelUnlocks(levels: readonly SetLevelProgressInput[]): LevelUnlockState[] {
  const ordered = levels
    .filter((l) => isMvpLevel(l.knowledgeLevel))
    .sort(
      (a, b) => UNLOCK_ORDER.indexOf(a.knowledgeLevel) - UNLOCK_ORDER.indexOf(b.knowledgeLevel),
    );
  const result: LevelUnlockState[] = [];
  let previous: LevelUnlockState | null = null;
  for (const level of ordered) {
    const lastConcept = lastCompletedConcept(level.attempts);
    const best = bestConcept(level.attempts);
    const unlocked = previous === null || previous.passed;
    const state: LevelUnlockState = {
      levelId: level.levelId,
      knowledgeLevel: level.knowledgeLevel,
      unlocked,
      lastConcept,
      bestConcept: best,
      passed: isPassing(best),
      requires: previous?.knowledgeLevel ?? null,
      start: unlocked ? decideStartLevel(level.attempts) : { allowed: false, reason: "LOCKED" },
    };
    result.push(state);
    previous = state;
  }
  return result;
}
