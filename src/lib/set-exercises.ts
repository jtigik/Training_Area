import type { Difficulty, KnowledgeLevel } from "@/lib/domain";

/** Conteúdo congelado em SetExercise.snapshot ao publicar o conjunto. */
export interface SetExerciseSnapshot {
  title: string;
  statement: string;
  initialSheet: unknown;
  expectedResult: unknown;
  gradingRules: unknown | null;
  hint: string | null;
  level: KnowledgeLevel;
  difficulty: Difficulty;
}

/** Referência de um item de exercício: pool (rascunho) ou cópia congelada (publicado). */
export type ExerciseRef = { type: "exercise"; id: string } | { type: "setExercise"; id: string };

/** Item servido por /sets/:id/exercises e pelo sorteio da rodada. */
export interface SetExerciseItem extends SetExerciseSnapshot {
  ref: ExerciseRef;
  /** Exercício de origem (pool: o próprio id; publicado: sourceExerciseId). */
  sourceExerciseId: string | null;
  isGlobal: boolean | null;
  position: number;
}

export function snapshotFromExercise(e: {
  title: string;
  statement: string;
  initialSheet: unknown;
  expectedResult: unknown;
  gradingRules: unknown | null;
  hint: string | null;
  level: KnowledgeLevel;
  difficulty: Difficulty;
}): SetExerciseSnapshot {
  return {
    title: e.title,
    statement: e.statement,
    initialSheet: e.initialSheet,
    expectedResult: e.expectedResult,
    gradingRules: e.gradingRules ?? null,
    hint: e.hint ?? null,
    level: e.level,
    difficulty: e.difficulty,
  };
}

/** Versão para o ALUNO: sem gabarito nem regras de correção. */
export type StudentExerciseItem = Omit<SetExerciseItem, "expectedResult" | "gradingRules">;

export function toStudentItem(item: SetExerciseItem): StudentExerciseItem {
  const visible: Partial<SetExerciseItem> = { ...item };
  delete visible.expectedResult;
  delete visible.gradingRules;
  return visible as StudentExerciseItem;
}
