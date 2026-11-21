/**
 * TODO(BE2, next step): `service.ts` (getTrail / getExercise / submitAttempt / redoLevel /
 * getLevelFeedback), in-memory ports + tests, Prisma adapters over `requireTenant().db` reusing
 * completeLevelAttempt / resolveQuota / levelPoolWhere / drawFromPool, and the /api/aluno routes.
 * This file is the agreed CONTRACT only (no runtime code yet).
 *
 * Student level/run engine — records mirror Backend 1's schema (feat/auth-modelo):
 *   ExerciseSet, Level, LevelAttempt (= a "run"; attemptNumber 1, 2, … per redo),
 *   ExerciseAttempt, Feedback, TenantGradingConfig, ExerciseQuota.
 * Response shapes follow Frontend 1's contract (wt-frontend1 src/lib/api/types.ts) plus the agreed
 * additions (bestConcept, run, concept/bestConcept on AttemptResult).
 * Every port method takes `tenantId`; Prisma implementations go through `forTenant`.
 */
import type { GradingBands } from "@/lib/grading";
import type { FeedbackCode } from "@/server/grading";
import type { MultiCellExercise } from "@/server/grading";
import type { Difficulty, GradeConcept, KnowledgeLevel, TenantId, UserId } from "@/server/domain";

export type Concept = GradeConcept;

// ---------------------------------------------------------------------------
// Records (persistence shapes)
// ---------------------------------------------------------------------------

export interface SetRecord {
  id: string;
  tenantId: TenantId;
  name: string;
  difficulties: Difficulty[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export interface LevelRecord {
  id: string;
  tenantId: TenantId;
  setId: string;
  knowledgeLevel: KnowledgeLevel;
  position: number;
}

/** prisma LevelAttempt. `exerciseIds` is the run's draw — NOT in the schema yet (requested). */
export interface LevelRunRecord {
  id: string;
  tenantId: TenantId;
  studentId: UserId;
  levelId: string;
  attemptNumber: number;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  concept: Concept | null;
  computedConcept: Concept | null;
  gradingBands: GradingBands | null;
  requiredCount: number;
  completedCount: number;
  correctCount: number;
  exerciseIds: string[];
  startedAt: Date;
  completedAt: Date | null;
}

/** prisma ExerciseAttempt (one final submission per exercise per run). */
export interface SubmissionRecord {
  id: string;
  tenantId: TenantId;
  studentId: UserId;
  levelAttemptId: string;
  exerciseId: string;
  difficulty: Difficulty;
  /** `{ "B4": { formula: "=SOMA(B1:B3)" } }` */
  submission: Record<string, { formula?: string; value?: string }>;
  isCorrect: boolean;
  clientIsCorrect: boolean | null;
  /** Feedback code of the official grading. */
  errorType: string | null;
  attemptNumber: number;
  createdAt: Date;
}

/** Published exercise from the level pool (tenant + global), content already parsed. */
export interface PoolExercise {
  id: string;
  title: string;
  statement: string;
  hint: string | null;
  level: KnowledgeLevel;
  difficulty: Difficulty;
  content: MultiCellExercise;
}

/** prisma Feedback status. The student only sees APPROVED. */
export interface LevelFeedbackRecord {
  status: "DRAFT" | "APPROVED" | "REJECTED";
  /** editedText ?? aiText */
  text: string;
  /** Optional structured lists (stored in `metrics` until a column exists). */
  strengths?: string[];
  toReview?: string[];
  reviewedAt: Date | null;
}

export interface SectionSummary {
  id: string;
  title: string;
  order: number;
  level: KnowledgeLevel | null;
  readMinutes?: number;
}

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

export interface LevelEnginePorts {
  sets: {
    /** The published set the student is enrolled in (MVP: latest published set of the tenant). */
    findActiveForStudent(tenantId: TenantId, studentId: UserId): Promise<SetRecord | null>;
  };
  levels: {
    listBySet(tenantId: TenantId, setId: string): Promise<LevelRecord[]>;
  };
  pool: {
    /** PUBLISHED exercises of the level with one of the set's difficulties (lib/pool.ts). */
    list(
      tenantId: TenantId,
      level: KnowledgeLevel,
      difficulties: Difficulty[],
    ): Promise<PoolExercise[]>;
    findByIds(tenantId: TenantId, ids: string[]): Promise<PoolExercise[]>;
  };
  quotas: {
    /** Resolved quantity (lib/quota.ts resolveQuota) or null when none is configured. */
    resolve(tenantId: TenantId, levelId: string, studentId: UserId): Promise<number | null>;
  };
  runs: {
    listByStudentLevel(
      tenantId: TenantId,
      studentId: UserId,
      levelId: string,
    ): Promise<LevelRunRecord[]>;
    /** Must fail (CONFLICT) when an IN_PROGRESS run already exists (partial unique index). */
    create(
      tenantId: TenantId,
      data: Omit<LevelRunRecord, "id" | "tenantId">,
    ): Promise<LevelRunRecord>;
    update(
      tenantId: TenantId,
      id: string,
      patch: Partial<Omit<LevelRunRecord, "id" | "tenantId">>,
    ): Promise<LevelRunRecord>;
  };
  submissions: {
    listByRuns(tenantId: TenantId, runIds: string[]): Promise<SubmissionRecord[]>;
    /**
     * Records the submission and bumps the run counters ATOMICALLY (Prisma: one transaction;
     * unique (levelAttemptId, exerciseId, attemptNumber) makes a concurrent duplicate fail →
     * ALREADY_SUBMITTED).
     */
    recordAndCount(
      tenantId: TenantId,
      data: Omit<SubmissionRecord, "id" | "tenantId" | "createdAt">,
    ): Promise<{ submission: SubmissionRecord; run: LevelRunRecord }>;
  };
  gradingBands: {
    get(tenantId: TenantId): Promise<GradingBands>;
  };
  feedback: {
    findForRun(tenantId: TenantId, levelAttemptId: string): Promise<LevelFeedbackRecord | null>;
  };
  sections?: {
    listByLevel(tenantId: TenantId, level: KnowledgeLevel | null): Promise<SectionSummary[]>;
  };
}

/** Called after a run completes (e.g. enqueue AI feedback generation). Errors are swallowed. */
export type LevelCompletedHook = (event: {
  tenantId: TenantId;
  studentId: UserId;
  run: LevelRunRecord;
  level: LevelRecord;
}) => Promise<void> | void;

// ---------------------------------------------------------------------------
// API shapes (Frontend 1 contract + agreed additions)
// ---------------------------------------------------------------------------

export type LevelStatus = "LOCKED" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type ExerciseStatus = "NOT_STARTED" | "CORRECT" | "INCORRECT";

export interface LevelProgress {
  required: number;
  done: number;
  correct: number;
}

export interface ExerciseSummary {
  id: string;
  title: string;
  difficulty: Difficulty;
  status: ExerciseStatus;
  attempts: number;
}

export interface TrailLevel {
  level: KnowledgeLevel;
  description: string;
  status: LevelStatus;
  progress: LevelProgress;
  sections: SectionSummary[];
  exercises: ExerciseSummary[];
  completedAt: string | null;
  /** Concept of the current run (set once it is COMPLETED). */
  concept: Concept | null;
  /** Best concept across completed runs (what unlocks the next level). */
  bestConcept: Concept | null;
  /** Current run number (1 = first pass; 0 when locked and never started). */
  run: number;
}

export interface Trail {
  set: { id: string; name: string } | null;
  levels: TrailLevel[];
  generalSections: SectionSummary[];
}

export interface StudentExercise {
  id: string;
  level: KnowledgeLevel;
  difficulty: Difficulty;
  title: string;
  statement: string;
  sheet: { rows: number; cols: number; cells: Record<string, string | number | boolean | null> };
  targetCell: string;
  targetCells: string[];
  relatedSection: { id: string; title: string } | null;
  status: ExerciseStatus;
  attempts: number;
  lastSubmission: string | null;
  position: { index: number; total: number; nextExerciseId: string | null };
}

export interface AttemptRequest {
  /** Content of the target cell; or a map cell → content for multi-cell exercises. */
  submission: string | Record<string, string>;
  clientValue?: string | number | boolean | null;
  clientIsCorrect?: boolean | null;
}

export interface AttemptResult {
  attemptId: string;
  correct: boolean;
  feedbackCode: FeedbackCode;
  actualValue: string | number | boolean | null;
  errors: { kind: string; code: string; message: string }[];
  hint: string | null;
  levelProgress: LevelProgress;
  levelStatus: LevelStatus;
  levelCompleted: boolean;
  /** Present when levelCompleted. */
  concept?: Concept;
  bestConcept?: Concept;
}

export type FeedbackStatus = "IN_REVIEW" | "PUBLISHED";

export interface LevelFeedback {
  level: KnowledgeLevel;
  completedAt: string;
  /** Concept of the latest completed run (the one this feedback refers to). */
  concept: Concept;
  bestConcept: Concept;
  run: number;
  status: FeedbackStatus;
  score: { correct: number; total: number; percent: number };
  attempts: number;
  difficultiesPracticed: Difficulty[];
  message: {
    paragraphs: string[];
    strengths: string[];
    toReview: string[];
    approvedAt: string;
  } | null;
  items: {
    exerciseId: string;
    title: string;
    difficulty: Difficulty;
    correct: boolean;
    attempts: number;
    lastSubmission: string | null;
  }[];
  nextLevel: {
    level: KnowledgeLevel;
    unlocked: boolean;
    exerciseCount: number;
    summary: string;
  } | null;
  recommendedSection: { id: string; title: string } | null;
}
