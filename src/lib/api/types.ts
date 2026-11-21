/**
 * Typed contracts the student area expects from the backend.
 *
 * ASSUMED, NOT YET CONFIRMED by Backend 1 (auth) / Backend 2 (content,
 * exercises, attempts). Aligned where possible with what already exists:
 *  - enums mirror prisma/schema.prisma on feat/auth-modelo (Role, KnowledgeLevel,
 *    Difficulty, LevelProgressStatus);
 *  - grading result mirrors StudentGradingResult / FeedbackCode from
 *    src/server/grading on feat/motor-exercicios (one target cell, one formula).
 * When real route handlers/schemas exist, replace or generate these.
 */
import type { CellInput } from "@/lib/formula/engine";

// ---------- Shared enums (mirror Prisma) ----------
export type Role = "STUDENT" | "TEACHER" | "ADMIN";
export type KnowledgeLevel = "FUNDAMENTAL" | "PROFESSIONAL" | "ADVANCED" | "DASHBOARD";
export type Difficulty = "VERY_EASY" | "EASY" | "MEDIUM" | "HARD" | "VERY_HARD";
/** Prisma LevelProgressStatus + LOCKED (derived: previous level not completed). */
export type LevelStatus = "LOCKED" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type ExerciseStatus = "NOT_STARTED" | "CORRECT" | "INCORRECT";

export const LEVEL_ORDER: KnowledgeLevel[] = [
  "FUNDAMENTAL",
  "PROFESSIONAL",
  "ADVANCED",
  "DASHBOARD",
];

export const LEVEL_LABELS: Record<KnowledgeLevel, string> = {
  FUNDAMENTAL: "Fundamental",
  PROFESSIONAL: "Profissional",
  ADVANCED: "Avançado",
  DASHBOARD: "Dashboard",
};

/** URL segment for each level (pt-BR, as in the wireframes). */
export const LEVEL_SLUGS: Record<KnowledgeLevel, string> = {
  FUNDAMENTAL: "fundamental",
  PROFESSIONAL: "profissional",
  ADVANCED: "avancado",
  DASHBOARD: "dashboard",
};

export function levelFromSlug(slug: string): KnowledgeLevel | null {
  const entry = Object.entries(LEVEL_SLUGS).find(([, s]) => s === slug);
  return entry ? (entry[0] as KnowledgeLevel) : null;
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  VERY_EASY: "Muito fácil",
  EASY: "Fácil",
  MEDIUM: "Médio",
  HARD: "Difícil",
  VERY_HARD: "Muito difícil",
};

export const DIFFICULTY_RANK: Record<Difficulty, 1 | 2 | 3 | 4 | 5> = {
  VERY_EASY: 1,
  EASY: 2,
  MEDIUM: 3,
  HARD: 4,
  VERY_HARD: 5,
};

export const LEVEL_STATUS_LABELS: Record<LevelStatus, string> = {
  LOCKED: "Bloqueado",
  NOT_STARTED: "Não iniciado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
};

export const EXERCISE_STATUS_LABELS: Record<ExerciseStatus, string> = {
  NOT_STARTED: "Não iniciado",
  CORRECT: "Correto",
  INCORRECT: "Incorreto",
};

// ---------- Backend 1: auth (Better Auth) ----------
/** POST /api/auth/sign-in/email  body: LoginRequest -> 200 { user } + session cookie | 401 */
export interface LoginRequest {
  email: string;
  password: string;
}

/** GET /api/auth/get-session -> 200 { user, session } | 200 null when signed out */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** POST /api/auth/sign-out -> 200 */

// ---------- Backend 2: trail / content ----------
export interface SectionSummary {
  id: string;
  title: string;
  order: number;
  /** null = conteúdo transversal (TA-012) */
  level: KnowledgeLevel | null;
  readMinutes?: number;
}

/** GET /api/student/sections/:id -> 200 Section */
export interface Section extends SectionSummary {
  /** Markdown body (TA-011) */
  body: string;
}

export interface ExerciseSummary {
  id: string;
  title: string;
  difficulty: Difficulty;
  status: ExerciseStatus;
  /** Submitted attempts (local tests in the browser do not count). */
  attempts: number;
}

export interface LevelProgress {
  /** Quantidade configurada pelo professor (TA-015/TA-020) */
  required: number;
  done: number;
  correct: number;
}

export interface TrailLevel {
  level: KnowledgeLevel;
  description: string;
  status: LevelStatus;
  progress: LevelProgress;
  sections: SectionSummary[];
  /** At most `progress.required` items (TA-020). Empty when LOCKED. */
  exercises: ExerciseSummary[];
  completedAt: string | null;
}

/** GET /api/student/trail -> 200 Trail | 200 { set: null } when nothing is published */
export interface Trail {
  set: { id: string; name: string } | null;
  levels: TrailLevel[];
  /** Seções sem nível (transversais) */
  generalSections: SectionSummary[];
}

// ---------- Backend 2: exercises & attempts ----------
/** GET /api/student/exercises/:id -> 200 Exercise (never includes the answer key) */
export interface Exercise {
  id: string;
  level: KnowledgeLevel;
  difficulty: Difficulty;
  title: string;
  /** Markdown */
  statement: string;
  /** Initial sheet: rows x cols, content by A1 address. Strings starting with "=" are formulas. */
  sheet: { rows: number; cols: number; cells: Record<string, CellInput> };
  /** The single cell the student must fill (ExerciseDefinition.targetCell). */
  targetCell: string;
  /** Content section recommended for this exercise, if any. */
  relatedSection: { id: string; title: string } | null;
  status: ExerciseStatus;
  attempts: number;
  /** Last submitted formula, to restore the cell when reopening. */
  lastSubmission: string | null;
  /** Position within the level, for navigation. */
  position: { index: number; total: number; nextExerciseId: string | null };
}

/** POST /api/student/exercises/:id/attempts body: AttemptRequest -> 201 AttemptResult */
export interface AttemptRequest {
  /** Content typed in the target cell, e.g. "=SOMA(B2:B6)". */
  submission: string;
  /** Client-side value check, so the server can log divergence (TA-022). Optional. */
  clientValue?: string | number | boolean | null;
}

/** Mirrors FeedbackCode in src/server/grading/types.ts (Backend 2). */
export type FeedbackCode =
  | "CORRECT"
  | "WRONG_VALUE"
  | "WRONG_TYPE"
  | "MISSING_REQUIRED_FUNCTION"
  | "FORBIDDEN_FUNCTION"
  | "UNSUPPORTED_FUNCTION"
  | "HARDCODED_VALUE"
  | "FORMULA_REQUIRED"
  | "FORMULA_ERROR"
  | "PARSE_ERROR"
  | "EMPTY_SUBMISSION"
  | "LIMIT_EXCEEDED"
  | "INVALID_EXERCISE";

export interface AttemptResult {
  attemptId: string;
  correct: boolean;
  feedbackCode: FeedbackCode;
  /** Value the submission evaluated to on the server. */
  actualValue: string | number | boolean | null;
  errors: { kind: string; code: string; message: string }[];
  /** Only on incorrect answers and only when the teacher registered one. Never the answer key. */
  hint: string | null;
  levelProgress: LevelProgress;
  levelStatus: LevelStatus;
  /** True when this attempt completed the level (TA-025). */
  levelCompleted: boolean;
}

/** GET /api/student/levels/:level/feedback -> 200 LevelFeedback | 404 if level not completed */
export interface LevelFeedback {
  level: KnowledgeLevel;
  completedAt: string;
  score: { correct: number; total: number; percent: number };
  /** Total submitted attempts in the level. */
  attempts: number;
  difficultiesPracticed: Difficulty[];
  /** Feedback por faixa de desempenho (TA-026/TA-027, regras/templates). Immutable once issued. */
  band: { label: string; range: string; paragraphs: string[] };
  strengths: string[];
  toReview: string[];
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

// ---------- Errors ----------
export interface ApiErrorBody {
  error: { code: string; message: string };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isUnauthenticated(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}
