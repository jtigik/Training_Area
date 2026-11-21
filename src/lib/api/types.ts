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

/**
 * Base path of the student API (Backend 2). Backend 1's RBAC protects /api/aluno/*
 * for ALUNO users, so every student endpoint lives under it.
 */
export const STUDENT_API = "/api/aluno";

// ---------- Shared enums (mirror Prisma) ----------
/** Mirrors Backend 1's Prisma Role (src/lib/roles.ts on feat/auth-modelo). */
export type Role = "SUPER_ADMIN" | "INSTITUTION_ADMIN" | "PROFESSOR" | "ALUNO";
/** Level enum as the backend may send it (DASHBOARD exists in the schema but is v1.1). */
export type ApiKnowledgeLevel = "FUNDAMENTAL" | "PROFESSIONAL" | "ADVANCED" | "DASHBOARD";
/**
 * Levels of the MVP. DASHBOARD moved to v1.1 and must not appear anywhere in the
 * student UI (not even as "em breve"): the API client drops it (see isMvpLevel).
 */
export type KnowledgeLevel = Exclude<ApiKnowledgeLevel, "DASHBOARD">;
export type Difficulty = "VERY_EASY" | "EASY" | "MEDIUM" | "HARD" | "VERY_HARD";
/** Prisma LevelProgressStatus + LOCKED (derived: previous level not completed). */
export type LevelStatus = "LOCKED" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type ExerciseStatus = "NOT_STARTED" | "CORRECT" | "INCORRECT";

export const LEVEL_ORDER: KnowledgeLevel[] = ["FUNDAMENTAL", "PROFESSIONAL", "ADVANCED"];

export function isMvpLevel(level: unknown): level is KnowledgeLevel {
  return typeof level === "string" && (LEVEL_ORDER as string[]).includes(level);
}

export const LEVEL_LABELS: Record<KnowledgeLevel, string> = {
  FUNDAMENTAL: "Fundamental",
  PROFESSIONAL: "Profissional",
  ADVANCED: "Avançado",
};

/** URL segment for each level (pt-BR, as in the wireframes). */
export const LEVEL_SLUGS: Record<KnowledgeLevel, string> = {
  FUNDAMENTAL: "fundamental",
  PROFESSIONAL: "profissional",
  ADVANCED: "avancado",
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

/**
 * Conceito do nível (rubrica): ND = Não desenvolvido, ED = Em desenvolvimento,
 * D = Desenvolvido, PD = Plenamente desenvolvido. Assigned by the backend when
 * the level is completed. "Refazer nível" is offered only for ND and ED.
 */
export type Concept = "ND" | "ED" | "D" | "PD";

export const CONCEPT_LABELS: Record<Concept, string> = {
  ND: "Não desenvolvido",
  ED: "Em desenvolvimento",
  D: "Desenvolvido",
  PD: "Plenamente desenvolvido",
};

/** "Refazer nível" is offered (unlimited) while the BEST concept is ND or ED. */
export function canRetake(concept: Concept | null | undefined): boolean {
  return concept === "ND" || concept === "ED";
}

/** Concepts that unlock the next level (PO rule): ND/ED keep it locked. */
export function isPassingConcept(concept: Concept | null | undefined): boolean {
  return concept === "D" || concept === "PD";
}

const CONCEPT_RANK: Record<Concept, number> = { ND: 0, ED: 1, D: 2, PD: 3 };
export function bestOf(a: Concept | null, b: Concept | null): Concept | null {
  if (!a) return b;
  if (!b) return a;
  return CONCEPT_RANK[b] > CONCEPT_RANK[a] ? b : a;
}

export const EXERCISE_STATUS_LABELS: Record<ExerciseStatus, string> = {
  NOT_STARTED: "Não iniciado",
  CORRECT: "Correto",
  INCORRECT: "Incorreto",
};

// ---------- Backend 1: auth (Better Auth, social providers only) ----------
/** Login is Google or Microsoft only (no e-mail/password form, no /cadastro). */
export type AuthProvider = "google" | "microsoft";

export const AUTH_PROVIDER_LABELS: Record<AuthProvider, string> = {
  google: "Google",
  microsoft: "Microsoft",
};

/**
 * POST /api/auth/sign-in/social  body: { provider, callbackURL }
 *   -> 200 { url, redirect: true }: the browser goes to the provider and comes back to callbackURL.
 * The mock signs in immediately instead.
 */
export type LoginStart =
  { kind: "redirect"; url: string } | { kind: "signed-in"; user: SessionUser };

/** GET /api/login-options (public) -> enabled providers (Backend 1). */
export interface LoginOptions {
  providers: { id: AuthProvider; label: string }[];
  /** Dev/test only; the student UI never shows an e-mail/password form. */
  emailPassword: boolean;
  oauthMode: string;
}

/** Tenant (instituição) of the user — the system is multi-tenant. */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

/**
 * GET /api/me -> 200 { user: SessionUser } | 401 (Backend 1).
 * `tenantId` and `tenant` are null only for SUPER_ADMIN (Backend 1 8d3b381: /api/me and
 * get-session both include `tenant`).
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string | null;
  tenant: Tenant | null;
}

/** Home of each role after login. Official area prefixes are Backend 1's (/super-admin, /admin, /professor). */
export const ROLE_HOME: Record<Role, string> = {
  ALUNO: "/aluno",
  PROFESSOR: "/professor/resultados",
  INSTITUTION_ADMIN: "/admin/usuarios",
  SUPER_ADMIN: "/super-admin/instituicoes",
};

/** Route prefixes each role may access (used to validate ?callbackUrl=). */
export const ROLE_PREFIXES: Record<Role, string[]> = {
  ALUNO: ["/aluno"],
  PROFESSOR: ["/professor"],
  INSTITUTION_ADMIN: ["/admin"],
  SUPER_ADMIN: ["/super-admin"],
};

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

/** GET {STUDENT_API}/sections/:id -> 200 Section */
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
  /** Concept of the current run, set once it is COMPLETED. */
  concept: Concept | null;
  /** Best concept across all runs; this is the one that counts (and unlocks the next level). */
  bestConcept: Concept | null;
  /** Current run, starting at 1 ("Refazer nível" starts a new one). */
  run: number;
}

/** POST {STUDENT_API}/levels/:level/redo -> 200 TrailLevel of the new run | 409 LEVEL_NOT_REDOABLE | 403 LEVEL_LOCKED */

/** GET {STUDENT_API}/trail -> 200 Trail | 200 { set: null } when nothing is published */
export interface Trail {
  set: { id: string; name: string } | null;
  levels: TrailLevel[];
  /** Seções sem nível (transversais) */
  generalSections: SectionSummary[];
}

// ---------- Backend 2: exercises & attempts ----------
/** GET {STUDENT_API}/exercises/:id -> 200 Exercise (never includes the answer key) */
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
  /** 0 or 1: the final submission is unique per exercise in each run (409 ALREADY_SUBMITTED). */
  attempts: number;
  /** Last submitted formula, to restore the cell when reopening. */
  lastSubmission: string | null;
  /** Position within the level, for navigation. */
  position: { index: number; total: number; nextExerciseId: string | null };
}

/** POST {STUDENT_API}/exercises/:id/attempts body: AttemptRequest -> 201 AttemptResult */
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
  | "INPUT_INSENSITIVE"
  | "VOLATILE_FUNCTION"
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
  /** Present when levelCompleted. */
  concept?: Concept;
  bestConcept?: Concept;
}

/**
 * GET {STUDENT_API}/levels/:level/feedback -> 200 LevelFeedback | 404 if level not completed.
 * The personalised text is AI-generated and only visible after the teacher approves it:
 * while status is IN_REVIEW, `message` is null (score/summary are still returned).
 */
export type FeedbackStatus = "IN_REVIEW" | "PUBLISHED";

export interface LevelFeedback {
  level: KnowledgeLevel;
  completedAt: string;
  /** Concept of this (latest) run. */
  concept: Concept;
  /** Best concept across runs (the one that counts). */
  bestConcept: Concept;
  run: number;
  status: FeedbackStatus;
  score: { correct: number; total: number; percent: number };
  /** Total submitted attempts in the level. */
  attempts: number;
  difficultiesPracticed: Difficulty[];
  /** Approved feedback (AI-generated, reviewed by the teacher). Immutable once published. */
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
