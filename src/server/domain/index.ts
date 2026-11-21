/**
 * Domain enums/ids shared by the exercise engine services.
 *
 * Values mirror the Prisma enums drafted by Backend 1 (feat/auth-modelo) so records map 1:1.
 * When the schema lands, replace these with the generated Prisma types.
 * DASHBOARD moved to v1.1 (scope change 21/11/2026) and is intentionally NOT an MVP level.
 */

export type TenantId = string;
export type UserId = string;

import { DIFFICULTIES, MVP_LEVELS, type Difficulty, type MvpLevel } from "@/lib/domain";

// Enums come from Backend 1's src/lib/domain.ts (mirror of prisma/schema.prisma).
export { DIFFICULTIES, PUBLICATION_STATUSES, MVP_LEVELS } from "@/lib/domain";
export type { Difficulty, PublicationStatus, GradeConcept } from "@/lib/domain";
/** Levels the engine accepts (MVP: DASHBOARD is v1.1). */
export type KnowledgeLevel = MvpLevel;

/** Roles from prisma `Role`. Staff = PROFESSOR / INSTITUTION_ADMIN. */
export type Role = "ALUNO" | "PROFESSOR" | "INSTITUTION_ADMIN" | "SUPER_ADMIN";

export interface Actor {
  userId: UserId;
  role: Role;
  tenantId: TenantId;
}

export const LEVEL_LABELS_PT_BR: Record<KnowledgeLevel, string> = {
  FUNDAMENTAL: "Fundamental",
  PROFESSIONAL: "Profissional",
  ADVANCED: "Avançado",
};

export const DIFFICULTY_LABELS_PT_BR: Record<Difficulty, string> = {
  VERY_EASY: "Muito fácil",
  EASY: "Fácil",
  MEDIUM: "Médio",
  HARD: "Difícil",
  VERY_HARD: "Muito difícil",
};

export function isMvpLevel(value: unknown): value is KnowledgeLevel {
  return typeof value === "string" && (MVP_LEVELS as readonly string[]).includes(value);
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

/** Error raised by services for expected failures (maps to 4xx in route handlers). */
export type DomainErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VALIDATION"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "NOT_ALLOWED"
  // student level/run rules (contract with Frontend 1)
  | "LEVEL_LOCKED"
  | "LEVEL_NOT_REDOABLE"
  | "LEVEL_NOT_COMPLETED"
  | "ALREADY_SUBMITTED"
  | "EXERCISE_NOT_IN_RUN"
  | "EMPTY_SUBMISSION"
  | "LIMIT_EXCEEDED"
  // teacher import
  | "IMPORT_INVALID";

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export type IdGenerator = () => string;

export const randomId: IdGenerator = () => globalThis.crypto.randomUUID();

/** Small deterministic PRNG (mulberry32) seeded from a string — for reproducible draws. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
