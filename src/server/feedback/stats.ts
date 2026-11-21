import type { Difficulty } from "@/server/domain";
import type { AttemptRecord, ExerciseRecord } from "@/server/exercises";
import type { FeedbackCode } from "@/server/grading";

export interface ExerciseSummary {
  exerciseId: string;
  title: string;
  difficulty: Difficulty;
  correct: boolean;
  attempts: number;
  correctOnFirstAttempt: boolean;
  /** Student's last submission per target cell (their own work; never the answer key). */
  lastSubmission: Record<string, string>;
  feedbackCodes: FeedbackCode[];
  analysis: {
    functions: string[];
    hardcodedNumbers: number[];
    referenceCount: number;
    absoluteReferences: number;
    maxNestingDepth: number;
    complexityScore: number;
  } | null;
}

export interface LevelStats {
  requiredCount: number;
  exercisesAttempted: number;
  exercisesCorrect: number;
  firstAttemptCorrect: number;
  totalAttempts: number;
  /** exercisesCorrect / requiredCount, 0–100. */
  accuracyPercent: number;
  difficulties: Partial<Record<Difficulty, { attempted: number; correct: number }>>;
  /** Non-correct feedback codes across all attempts, most frequent first. */
  frequentErrors: Array<{ code: FeedbackCode; count: number }>;
  formulaHabits: {
    functionsUsed: Array<{ name: string; count: number }>;
    attemptsWithHardcodedNumbers: number;
    attemptsWithoutReferences: number;
    attemptsWithAbsoluteReferences: number;
    averageComplexity: number | null;
    maxNestingDepth: number;
  };
  exercises: ExerciseSummary[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Aggregates one level cycle's attempts into the stats used for concept and AI feedback. */
export function computeLevelStats(
  attempts: AttemptRecord[],
  exercises: Pick<ExerciseRecord, "id" | "title" | "difficulty">[],
  requiredCount: number,
): LevelStats {
  const byExercise = new Map<string, AttemptRecord[]>();
  const sorted = attempts.slice().sort((a, b) => a.attemptNumber - b.attemptNumber);
  for (const a of sorted)
    byExercise.set(a.exerciseId, [...(byExercise.get(a.exerciseId) ?? []), a]);
  const meta = new Map(exercises.map((e) => [e.id, e]));

  const errors = new Map<FeedbackCode, number>();
  const fnCount = new Map<string, number>();
  let hardcoded = 0;
  let noRefs = 0;
  let absRefs = 0;
  let maxDepth = 0;
  const complexities: number[] = [];

  const summaries: ExerciseSummary[] = [];
  const difficulties: LevelStats["difficulties"] = {};
  for (const [exerciseId, list] of byExercise) {
    const correct = list.some((a) => a.isCorrect);
    const first = list[0]!;
    const last = list[list.length - 1]!;
    const difficulty = meta.get(exerciseId)?.difficulty ?? first.difficulty;
    const d = (difficulties[difficulty] ??= { attempted: 0, correct: 0 });
    d.attempted += 1;
    if (correct) d.correct += 1;

    for (const a of list) {
      for (const cell of Object.values(a.grading.cells)) {
        if (cell.feedbackCode !== "CORRECT")
          errors.set(cell.feedbackCode, (errors.get(cell.feedbackCode) ?? 0) + 1);
        const an = cell.analysis;
        if (!an) continue;
        for (const f of an.functions) fnCount.set(f.name, (fnCount.get(f.name) ?? 0) + f.count);
        if (an.flags.usesHardcodedNumbers) hardcoded += 1;
        if (!an.flags.hasCellReferences) noRefs += 1;
        if (an.flags.usesAbsoluteReferences) absRefs += 1;
        maxDepth = Math.max(maxDepth, an.maxNestingDepth);
        complexities.push(an.complexityScore);
      }
    }
    const lastAnalyses = Object.values(last.grading.cells)
      .map((c) => c.analysis)
      .filter((x) => x !== null);
    summaries.push({
      exerciseId,
      title: meta.get(exerciseId)?.title ?? exerciseId,
      difficulty,
      correct,
      attempts: list.length,
      correctOnFirstAttempt: first.isCorrect,
      lastSubmission: last.submission,
      feedbackCodes: Object.values(last.grading.cells).map((c) => c.feedbackCode),
      analysis:
        lastAnalyses.length === 0
          ? null
          : {
              functions: [...new Set(lastAnalyses.flatMap((a) => a.uniqueFunctions))].sort(),
              hardcodedNumbers: lastAnalyses.flatMap((a) => a.hardcodedNumbers),
              referenceCount: lastAnalyses.reduce((s, a) => s + a.referenceCount, 0),
              absoluteReferences: lastAnalyses.reduce((s, a) => s + a.absoluteReferenceCount, 0),
              maxNestingDepth: Math.max(...lastAnalyses.map((a) => a.maxNestingDepth)),
              complexityScore: round1(lastAnalyses.reduce((s, a) => s + a.complexityScore, 0)),
            },
    });
  }
  const exercisesCorrect = summaries.filter((s) => s.correct).length;
  const den = Math.max(1, requiredCount);
  return {
    requiredCount,
    exercisesAttempted: summaries.length,
    exercisesCorrect,
    firstAttemptCorrect: summaries.filter((s) => s.correctOnFirstAttempt).length,
    totalAttempts: attempts.length,
    accuracyPercent: round1(Math.min(100, (exercisesCorrect / den) * 100)),
    difficulties,
    frequentErrors: [...errors.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    formulaHabits: {
      functionsUsed: [...fnCount.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      attemptsWithHardcodedNumbers: hardcoded,
      attemptsWithoutReferences: noRefs,
      attemptsWithAbsoluteReferences: absRefs,
      averageComplexity: complexities.length
        ? round1(complexities.reduce((s, c) => s + c, 0) / complexities.length)
        : null,
      maxNestingDepth: maxDepth,
    },
    exercises: summaries.sort((a, b) => a.title.localeCompare(b.title)),
  };
}
