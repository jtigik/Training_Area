import {
  DomainError,
  MVP_LEVELS,
  type Actor,
  type KnowledgeLevel,
  type TenantId,
  type UserId,
} from "@/server/domain";

import type { AttemptFilter, AttemptRecord, AttemptRepository, ExerciseRepository } from "./types";

export type LevelStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface LevelResult {
  status: LevelStatus;
  /** Latest cycle considered (retries start a new cycle). */
  levelCycle: number;
  exercisesAttempted: number;
  exercisesCorrect: number;
  attempts: number;
  /** exercisesCorrect / exercisesAttempted, 0–100 (null when nothing attempted). */
  accuracyPercent: number | null;
  lastAttemptAt: Date | null;
}

export interface StudentResultRow {
  studentId: UserId;
  levels: Record<KnowledgeLevel, LevelResult>;
}

export interface ClassResults {
  rows: StudentResultRow[];
  totals: {
    students: number;
    attempts: number;
    exercisesAttempted: number;
    exercisesCorrect: number;
    accuracyPercent: number | null;
  };
}

export interface ClassResultsQuery extends Omit<
  AttemptFilter,
  "studentId" | "exerciseId" | "levelCycle"
> {
  setId: string;
  /** Roster: students appear even without attempts (TA-028). Defaults to students with attempts. */
  studentIds?: UserId[];
  /** Resolved quota per level, used to flag COMPLETED. */
  requiredCountByLevel?: Partial<Record<KnowledgeLevel, number>>;
}

const pct = (num: number, den: number): number | null =>
  den === 0 ? null : Math.round((num / den) * 1000) / 10;

function assertStaff(actor: Actor, tenantId: TenantId): void {
  if (actor.tenantId !== tenantId) throw new DomainError("FORBIDDEN", "Cross-tenant access denied");
  if (actor.role !== "TEACHER" && actor.role !== "ADMIN") {
    throw new DomainError("FORBIDDEN", "Teacher or admin role required");
  }
}

/** Summarises a student's attempts for one level, using only the latest cycle. */
export function summarizeLevel(attempts: AttemptRecord[], requiredCount?: number): LevelResult {
  if (attempts.length === 0) {
    return {
      status: "NOT_STARTED",
      levelCycle: 1,
      exercisesAttempted: 0,
      exercisesCorrect: 0,
      attempts: 0,
      accuracyPercent: null,
      lastAttemptAt: null,
    };
  }
  const cycle = Math.max(...attempts.map((a) => a.levelCycle));
  const current = attempts.filter((a) => a.levelCycle === cycle);
  const byExercise = new Map<string, boolean>();
  for (const a of current)
    byExercise.set(a.exerciseId, (byExercise.get(a.exerciseId) ?? false) || a.isCorrect);
  const attempted = byExercise.size;
  const correct = [...byExercise.values()].filter(Boolean).length;
  const last = current.reduce((m, a) => (a.createdAt > m ? a.createdAt : m), current[0]!.createdAt);
  return {
    status: requiredCount !== undefined && attempted >= requiredCount ? "COMPLETED" : "IN_PROGRESS",
    levelCycle: cycle,
    exercisesAttempted: attempted,
    exercisesCorrect: correct,
    attempts: current.length,
    accuracyPercent: pct(correct, attempted),
    lastAttemptAt: last,
  };
}

export class ResultsService {
  constructor(
    private readonly deps: { attempts: AttemptRepository; exercises: ExerciseRepository },
  ) {}

  /** Class overview per student and level, with filters by level, difficulty and period (TA-028/TA-030). */
  async getClassResults(
    actor: Actor,
    tenantId: TenantId,
    query: ClassResultsQuery,
  ): Promise<ClassResults> {
    assertStaff(actor, tenantId);
    const attempts = await this.deps.attempts.list(tenantId, {
      setId: query.setId,
      level: query.level,
      difficulty: query.difficulty,
      from: query.from,
      to: query.to,
      studentIds: query.studentIds,
    });
    const students = query.studentIds ?? [...new Set(attempts.map((a) => a.studentId))].sort();
    const levels = query.level ? [query.level] : [...MVP_LEVELS];
    const rows: StudentResultRow[] = students.map((studentId) => {
      const mine = attempts.filter((a) => a.studentId === studentId);
      const byLevel = {} as Record<KnowledgeLevel, LevelResult>;
      for (const level of levels) {
        byLevel[level] = summarizeLevel(
          mine.filter((a) => a.level === level),
          query.requiredCountByLevel?.[level],
        );
      }
      return { studentId, levels: byLevel };
    });
    let ex = 0;
    let ok = 0;
    for (const r of rows) {
      for (const l of Object.values(r.levels)) {
        ex += l.exercisesAttempted;
        ok += l.exercisesCorrect;
      }
    }
    return {
      rows,
      totals: {
        students: rows.length,
        attempts: attempts.length,
        exercisesAttempted: ex,
        exercisesCorrect: ok,
        accuracyPercent: pct(ok, ex),
      },
    };
  }

  /**
   * Attempts of one student with submitted formulas and grading outcome (TA-029). Only submitted
   * attempts exist here (local tests never reach the server). Staff only: students get 403.
   */
  async getStudentDetail(
    actor: Actor,
    tenantId: TenantId,
    studentId: UserId,
    filter: Omit<AttemptFilter, "studentId" | "studentIds"> = {},
  ) {
    assertStaff(actor, tenantId);
    const attempts = await this.deps.attempts.list(tenantId, { ...filter, studentId });
    const titles = new Map<string, string>();
    for (const id of new Set(attempts.map((a) => a.exerciseId))) {
      titles.set(
        id,
        (await this.deps.exercises.findById(tenantId, id))?.title ?? "(exercício removido)",
      );
    }
    return attempts
      .slice()
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.levelCycle - a.levelCycle ||
          b.attemptNumber - a.attemptNumber,
      )
      .map((a) => ({
        attemptId: a.id,
        exerciseId: a.exerciseId,
        exerciseTitle: titles.get(a.exerciseId)!,
        level: a.level,
        difficulty: a.difficulty,
        levelCycle: a.levelCycle,
        attemptNumber: a.attemptNumber,
        submittedAt: a.createdAt,
        submission: a.submission,
        isCorrect: a.isCorrect,
        divergent: a.divergent,
        cells: Object.fromEntries(
          Object.entries(a.grading.cells).map(([addr, r]) => [
            addr,
            {
              feedbackCode: r.feedbackCode,
              actualValue: r.actualValue,
              expectedValue: r.expectedValue,
              analysis: r.analysis,
            },
          ]),
        ),
      }));
  }
}
