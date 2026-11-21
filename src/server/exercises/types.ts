import type {
  Difficulty,
  KnowledgeLevel,
  PublicationStatus,
  TenantId,
  UserId,
} from "@/server/domain";
import type {
  MultiCellExercise,
  MultiCellGradingResult,
  StudentGradingResult,
} from "@/server/grading";

/** Exercise set (trilha). Mirrors Backend 1's ExerciseSet + tenantId. */
export interface ExerciseSetRecord {
  id: string;
  tenantId: TenantId;
  name: string;
  levels: KnowledgeLevel[];
  difficulties: Difficulty[];
  status: PublicationStatus;
}

/**
 * Exercise. `content` is the grading definition (sheet + target cells + rules) and maps to
 * Backend 1's `initialSheet`/`expectedResult` JSON (see grading/multi.ts `fromSchemaExercise`).
 */
export interface ExerciseRecord {
  id: string;
  tenantId: TenantId;
  setId: string;
  title: string;
  statement: string;
  hint: string | null;
  level: KnowledgeLevel;
  difficulty: Difficulty;
  status: PublicationStatus;
  position: number;
  authorId: UserId | null;
  content: MultiCellExercise;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttemptRecord {
  id: string;
  tenantId: TenantId;
  studentId: UserId;
  exerciseId: string;
  setId: string;
  level: KnowledgeLevel;
  difficulty: Difficulty;
  /** Level cycle: 1 for the first run of the level, 2+ for retries (ND/ED). */
  levelCycle: number;
  /** 1, 2, 3… per (student, exercise, cycle). */
  attemptNumber: number;
  /** What the student typed per target cell. */
  submission: Record<string, string>;
  isCorrect: boolean;
  clientIsCorrect: boolean | null;
  /** Client and server grading disagreed (TA-022). */
  divergent: boolean;
  /** Server grading payload (contains answer key: teacher/server only). */
  grading: MultiCellGradingResult;
  createdAt: Date;
}

/** What a student receives after submitting (no answer key). */
export interface StudentAttemptResult {
  attemptId: string;
  attemptNumber: number;
  correct: boolean;
  cells: Record<string, StudentGradingResult>;
  /** Teacher hint, only when incorrect (TA-022). */
  hint: string | null;
}

/** Student-facing exercise (answer keys stripped). */
export interface StudentExerciseView {
  id: string;
  setId: string;
  title: string;
  statement: string;
  level: KnowledgeLevel;
  difficulty: Difficulty;
  sheet: MultiCellExercise["sheet"];
  targetCells: string[];
}

export interface ExerciseFilter {
  setId?: string;
  level?: KnowledgeLevel;
  difficulty?: Difficulty;
  status?: PublicationStatus;
}

export interface AttemptFilter {
  setId?: string;
  studentId?: UserId;
  studentIds?: UserId[];
  exerciseId?: string;
  level?: KnowledgeLevel;
  difficulty?: Difficulty;
  levelCycle?: number;
  /** Inclusive lower bound on createdAt. */
  from?: Date;
  /** Exclusive upper bound on createdAt. */
  to?: Date;
}

/**
 * Persistence ports. Every method takes `tenantId` explicitly; implementations MUST filter by it
 * (Prisma: `where: { tenantId, ... }`). Records from another tenant behave as "not found".
 */
export interface ExerciseSetRepository {
  findById(tenantId: TenantId, id: string): Promise<ExerciseSetRecord | null>;
}

export interface ExerciseRepository {
  create(
    tenantId: TenantId,
    data: Omit<ExerciseRecord, "id" | "tenantId" | "createdAt" | "updatedAt">,
  ): Promise<ExerciseRecord>;
  update(
    tenantId: TenantId,
    id: string,
    patch: Partial<Omit<ExerciseRecord, "id" | "tenantId" | "createdAt">>,
  ): Promise<ExerciseRecord | null>;
  findById(tenantId: TenantId, id: string): Promise<ExerciseRecord | null>;
  list(tenantId: TenantId, filter: ExerciseFilter): Promise<ExerciseRecord[]>;
}

export interface AttemptRepository {
  create(tenantId: TenantId, data: Omit<AttemptRecord, "id" | "tenantId">): Promise<AttemptRecord>;
  list(tenantId: TenantId, filter: AttemptFilter): Promise<AttemptRecord[]>;
  count(tenantId: TenantId, filter: AttemptFilter): Promise<number>;
}
