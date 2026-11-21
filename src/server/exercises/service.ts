import type { z } from "zod";

import {
  DomainError,
  seededRandom,
  type Actor,
  type Difficulty,
  type KnowledgeLevel,
  type TenantId,
  type UserId,
} from "@/server/domain";
import {
  gradeMultiCellSubmission,
  toStudentResult,
  toStudentSheet,
  validateMultiCellExercise,
  type MultiCellExercise,
} from "@/server/grading";

import {
  createExerciseSchema,
  submissionSchema,
  updateExerciseSchema,
  type CreateExerciseInput,
  type SubmissionInput,
  type UpdateExerciseInput,
} from "./schemas";
import type {
  AttemptRecord,
  AttemptRepository,
  ExerciseFilter,
  ExerciseRecord,
  ExerciseRepository,
  ExerciseSetRepository,
  StudentAttemptResult,
  StudentExerciseView,
} from "./types";

export interface ExerciseServiceDeps {
  sets: ExerciseSetRepository;
  exercises: ExerciseRepository;
  attempts: AttemptRepository;
  clock?: { now(): Date };
  /** Called when client and server grading diverge (TA-022: incident recorded for the team). */
  onDivergence?: (attempt: AttemptRecord) => void | Promise<void>;
}

const STAFF = new Set(["TEACHER", "ADMIN"]);

function assertTenant(actor: Actor, tenantId: TenantId): void {
  if (actor.tenantId !== tenantId) throw new DomainError("FORBIDDEN", "Cross-tenant access denied");
}

function assertStaff(actor: Actor, tenantId: TenantId): void {
  assertTenant(actor, tenantId);
  if (!STAFF.has(actor.role)) throw new DomainError("FORBIDDEN", "Teacher or admin role required");
}

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new DomainError("VALIDATION", "Invalid input", r.error.issues);
  return r.data;
}

function validateContent(content: MultiCellExercise): void {
  const v = validateMultiCellExercise(content);
  if (!v.valid) throw new DomainError("VALIDATION", "Invalid exercise content", v.errors);
}

export function toStudentExerciseView(e: ExerciseRecord): StudentExerciseView {
  const { sheet, targetCells } = toStudentSheet(e.content);
  return {
    id: e.id,
    setId: e.setId,
    title: e.title,
    statement: e.statement,
    level: e.level,
    difficulty: e.difficulty,
    sheet,
    targetCells,
  };
}

/** Teacher CRUD, draw by level/difficulty, attempt registration (route-agnostic). */
export class ExerciseService {
  private readonly clock: { now(): Date };

  constructor(private readonly deps: ExerciseServiceDeps) {
    this.clock = deps.clock ?? { now: () => new Date() };
  }

  private async loadSet(tenantId: TenantId, setId: string) {
    const set = await this.deps.sets.findById(tenantId, setId);
    if (!set) throw new DomainError("NOT_FOUND", "Exercise set not found");
    return set;
  }

  private assertInSet(
    set: { levels: KnowledgeLevel[]; difficulties: Difficulty[] },
    level: KnowledgeLevel,
    difficulty: Difficulty,
  ): void {
    if (!set.levels.includes(level)) {
      throw new DomainError("VALIDATION", `Level ${level} is not part of this set (TA-017)`);
    }
    if (!set.difficulties.includes(difficulty)) {
      throw new DomainError("VALIDATION", `Difficulty ${difficulty} is not part of this set`);
    }
  }

  async createExercise(actor: Actor, tenantId: TenantId, input: CreateExerciseInput) {
    assertStaff(actor, tenantId);
    const data = parse(createExerciseSchema, input);
    const set = await this.loadSet(tenantId, data.setId);
    this.assertInSet(set, data.level, data.difficulty);
    validateContent(data.content as MultiCellExercise);
    return this.deps.exercises.create(tenantId, {
      setId: data.setId,
      title: data.title,
      statement: data.statement,
      hint: data.hint ?? null,
      level: data.level,
      difficulty: data.difficulty,
      status: "DRAFT",
      position: data.position ?? 0,
      authorId: actor.userId,
      content: data.content as MultiCellExercise,
    });
  }

  async updateExercise(actor: Actor, tenantId: TenantId, id: string, input: UpdateExerciseInput) {
    assertStaff(actor, tenantId);
    const patch = parse(updateExerciseSchema, input);
    const current = await this.getExercise(actor, tenantId, id);
    const set = await this.loadSet(tenantId, current.setId);
    this.assertInSet(set, patch.level ?? current.level, patch.difficulty ?? current.difficulty);
    if (patch.content) validateContent(patch.content as MultiCellExercise);
    const updated = await this.deps.exercises.update(tenantId, id, {
      ...patch,
      hint: patch.hint === undefined ? undefined : (patch.hint ?? null),
      content: patch.content as MultiCellExercise | undefined,
      updatedAt: this.clock.now(),
    });
    if (!updated) throw new DomainError("NOT_FOUND", "Exercise not found");
    return updated;
  }

  /** Soft delete: archived exercises keep their attempts (history). */
  async archiveExercise(actor: Actor, tenantId: TenantId, id: string) {
    return this.updateExercise(actor, tenantId, id, { status: "ARCHIVED" });
  }

  async getExercise(actor: Actor, tenantId: TenantId, id: string): Promise<ExerciseRecord> {
    assertStaff(actor, tenantId);
    const e = await this.deps.exercises.findById(tenantId, id);
    if (!e) throw new DomainError("NOT_FOUND", "Exercise not found");
    return e;
  }

  async listExercises(actor: Actor, tenantId: TenantId, filter: ExerciseFilter = {}) {
    assertStaff(actor, tenantId);
    return this.deps.exercises.list(tenantId, filter);
  }

  /**
   * Draws up to `quantity` published exercises of a level (optionally one difficulty) for a
   * student. The draw is deterministic per (tenant, student, set, level, difficulty, cycle), so
   * the list is stable when the student comes back (TA-020); a retry cycle gets a new draw.
   * `quantity` is the resolved quota (Backend 1's ExerciseQuota resolution happens upstream).
   */
  async drawExercises(
    actor: Actor,
    tenantId: TenantId,
    params: {
      studentId: UserId;
      setId: string;
      level: KnowledgeLevel;
      difficulty?: Difficulty;
      quantity: number;
      levelCycle?: number;
    },
  ): Promise<{ exercises: StudentExerciseView[]; requested: number; shortfall: number }> {
    assertTenant(actor, tenantId);
    if (actor.role === "STUDENT" && actor.userId !== params.studentId) {
      throw new DomainError("FORBIDDEN", "Students can only draw their own exercises");
    }
    if (!Number.isInteger(params.quantity) || params.quantity <= 0) {
      throw new DomainError("VALIDATION", "quantity must be a positive integer");
    }
    const set = await this.loadSet(tenantId, params.setId);
    if (set.status !== "PUBLISHED")
      throw new DomainError("NOT_FOUND", "Exercise set not published");
    if (!set.levels.includes(params.level)) throw new DomainError("VALIDATION", "Level not in set");

    const pool = (
      await this.deps.exercises.list(tenantId, {
        setId: params.setId,
        level: params.level,
        difficulty: params.difficulty,
        status: "PUBLISHED",
      })
    )
      .filter((e) => set.difficulties.includes(e.difficulty))
      .sort((a, b) => a.id.localeCompare(b.id));

    const rand = seededRandom(
      [
        tenantId,
        params.studentId,
        params.setId,
        params.level,
        params.difficulty ?? "*",
        params.levelCycle ?? 1,
      ].join("|"),
    );
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    const picked = pool
      .slice(0, params.quantity)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    return {
      exercises: picked.map(toStudentExerciseView),
      requested: params.quantity,
      shortfall: Math.max(0, params.quantity - picked.length),
    };
  }

  /** Grades on the server (official result), stores the attempt and returns the student view. */
  async registerAttempt(
    actor: Actor,
    tenantId: TenantId,
    input: SubmissionInput,
  ): Promise<StudentAttemptResult> {
    assertTenant(actor, tenantId);
    if (actor.role !== "STUDENT")
      throw new DomainError("FORBIDDEN", "Only students submit attempts");
    const data = parse(submissionSchema, input);
    const exercise = await this.deps.exercises.findById(tenantId, data.exerciseId);
    if (!exercise || exercise.status !== "PUBLISHED")
      throw new DomainError("NOT_FOUND", "Exercise not found");

    const grading = gradeMultiCellSubmission(exercise.content, data.submission);
    const previous = await this.deps.attempts.count(tenantId, {
      studentId: actor.userId,
      exerciseId: exercise.id,
      levelCycle: data.levelCycle,
    });
    const clientIsCorrect = data.clientIsCorrect ?? null;
    const attempt = await this.deps.attempts.create(tenantId, {
      studentId: actor.userId,
      exerciseId: exercise.id,
      setId: exercise.setId,
      level: exercise.level,
      difficulty: exercise.difficulty,
      levelCycle: data.levelCycle,
      attemptNumber: previous + 1,
      submission: data.submission,
      isCorrect: grading.correct,
      clientIsCorrect,
      divergent: clientIsCorrect !== null && clientIsCorrect !== grading.correct,
      grading,
      createdAt: this.clock.now(),
    });
    if (attempt.divergent) await this.deps.onDivergence?.(attempt);

    const cells: StudentAttemptResult["cells"] = {};
    for (const [addr, r] of Object.entries(grading.cells)) cells[addr] = toStudentResult(r);
    return {
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      correct: grading.correct,
      cells,
      hint: grading.correct ? null : exercise.hint,
    };
  }
}
