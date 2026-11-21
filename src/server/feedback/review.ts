import {
  DomainError,
  randomId,
  systemClock,
  type Actor,
  type Clock,
  type IdGenerator,
  type KnowledgeLevel,
  type TenantId,
  type UserId,
} from "@/server/domain";
import { AiProviderError, type AiProvider } from "@/server/ai";
import type { AttemptRecord, ExerciseRecord } from "@/server/exercises";

import {
  canRetryLevel,
  computeConcept,
  resolveConceptRules,
  type Concept,
  type ConceptRules,
  type RetryEligibility,
} from "./concept";
import {
  feedbackContentSchema,
  findAnswerKeyLeaks,
  parseFeedbackOutput,
  type FeedbackContent,
  type FeedbackContentInput,
} from "./output";
import { buildFeedbackPrompt, buildRulesDraft, type FeedbackPromptInput } from "./prompt";
import { computeLevelStats, type LevelStats } from "./stats";
import { resolveTemplate, type FeedbackTemplateRecord, type TemplateSnapshot } from "./templates";

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

/** Review status = Backend 1's `FeedbackStatus` (DRAFT | APPROVED | REJECTED). */
export const REVIEW_STATUSES = ["DRAFT", "REJECTED", "APPROVED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
/** AI generation status, separate from the review status (agreed with Backend 1 / FE2). */
export const GENERATION_STATUSES = ["PENDING", "GENERATED", "FAILED"] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];
export type ReviewAction = "approve" | "edit" | "reject" | "regenerate";

/**
 *   DRAFT ──approve──► APPROVED (terminal)       DRAFT ──reject──► REJECTED
 *   REJECTED ──approve──► APPROVED               DRAFT | REJECTED ──regenerate──► DRAFT
 *   DRAFT | REJECTED ──edit (PATCH finalText)──► same status
 * Approving needs either a GENERATED draft or a non-empty teacher `finalText` — so a review
 * whose AI generation FAILED can still be approved with a manual write-up.
 * Any action on APPROVED (or reject on REJECTED) → ALREADY_REVIEWED (409).
 * Students only ever see APPROVED.
 */
const TRANSITIONS: Record<ReviewStatus, readonly ReviewAction[]> = {
  DRAFT: ["approve", "edit", "reject", "regenerate"],
  REJECTED: ["approve", "edit", "regenerate"],
  APPROVED: [],
};

export function canTransition(status: ReviewStatus, action: ReviewAction): boolean {
  return TRANSITIONS[status].includes(action);
}

export const VISIBLE_TO_STUDENT: readonly ReviewStatus[] = ["APPROVED"];
export const MAX_GENERATIONS = 5;
export const MAX_FINAL_TEXT = 4000;

// ---------------------------------------------------------------------------
// Records and repository port
// ---------------------------------------------------------------------------

export type FeedbackSource = "AI" | "RULES" | "PROFESSOR";

export interface DraftGeneration {
  generation: number;
  source: "AI" | "RULES";
  provider: string | null;
  model: string | null;
  content: FeedbackContent | null;
  error: string | null;
  warnings: string[];
  teacherGuidance: string | null;
  createdAt: Date;
}

export interface FeedbackReviewRecord {
  id: string;
  tenantId: TenantId;
  studentId: UserId;
  setId: string;
  level: KnowledgeLevel;
  levelCycle: number;
  concept: Concept;
  conceptPercent: number;
  retry: RetryEligibility;
  rules: ConceptRules;
  stats: LevelStats;
  template: TemplateSnapshot;
  /** Answer keys of the level's exercises, server-side only, used for leak checks. */
  answerKeys: string[];
  status: ReviewStatus;
  generationStatus: GenerationStatus;
  /** Last generation error (null unless generationStatus = FAILED). */
  generationError: string | null;
  /** Latest draft (null when generation failed). */
  draft: FeedbackContent | null;
  /** Teacher's text (PATCH/approve). When set it replaces the draft message for the student. */
  finalText: string | null;
  generations: DraftGeneration[];
  /** Content visible to the student once approved (immutable afterwards). */
  final: FeedbackContent | null;
  finalSource: FeedbackSource | null;
  reviewerId: UserId | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  /** Optimistic-locking version, incremented on every update. */
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewKey {
  studentId: UserId;
  setId: string;
  level: KnowledgeLevel;
  levelCycle: number;
}

export interface ReviewFilter {
  status?: ReviewStatus | ReviewStatus[];
  setId?: string;
  level?: KnowledgeLevel;
  studentId?: UserId;
}

export interface FeedbackReviewRepository {
  create(tenantId: TenantId, record: FeedbackReviewRecord): Promise<FeedbackReviewRecord>;
  findById(tenantId: TenantId, id: string): Promise<FeedbackReviewRecord | null>;
  findByKey(tenantId: TenantId, key: ReviewKey): Promise<FeedbackReviewRecord | null>;
  /** Applies `next` only if the stored version equals `expectedVersion`; returns null otherwise. */
  update(
    tenantId: TenantId,
    expectedVersion: number,
    next: FeedbackReviewRecord,
  ): Promise<FeedbackReviewRecord | null>;
  list(tenantId: TenantId, filter: ReviewFilter): Promise<FeedbackReviewRecord[]>;
}

export interface FeedbackTemplateRepository {
  /** Templates of the tenant that may apply to the set (setId = set or null). */
  listForSet(tenantId: TenantId, setId: string): Promise<FeedbackTemplateRecord[]>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface LevelCompletionInput {
  studentId: UserId;
  setId: string;
  level: KnowledgeLevel;
  levelCycle: number;
  /** Resolved quota for the level (snapshot). */
  requiredCount: number;
  /** Attempts of this student, set, level and cycle. */
  attempts: AttemptRecord[];
  /** Exercises referenced by the attempts (titles, difficulty, answer keys for leak checks). */
  exercises: Pick<ExerciseRecord, "id" | "title" | "difficulty" | "content">[];
  /** Teacher-configured concept rules for this level (defaults applied). */
  conceptRules?: Partial<ConceptRules> | null;
}

export interface StudentFeedbackView {
  setId: string;
  level: KnowledgeLevel;
  levelCycle: number;
  concept: Concept;
  conceptPercent: number;
  canRetry: boolean;
  content: FeedbackContent;
  approvedAt: Date;
}

export interface FeedbackServiceDeps {
  reviews: FeedbackReviewRepository;
  templates: FeedbackTemplateRepository;
  /** null = AI disabled (rule-based drafts). */
  ai: AiProvider | null;
  clock?: Clock;
  newId?: IdGenerator;
}

function normalizeFinalText(text: string | null | undefined): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  if (t.length > MAX_FINAL_TEXT)
    throw new DomainError("VALIDATION", `finalText exceeds ${MAX_FINAL_TEXT} characters`);
  return t;
}

function assertStaff(actor: Actor, tenantId: TenantId): void {
  if (actor.tenantId !== tenantId) throw new DomainError("FORBIDDEN", "Cross-tenant access denied");
  if (actor.role !== "PROFESSOR" && actor.role !== "INSTITUTION_ADMIN") {
    throw new DomainError("FORBIDDEN", "Teacher or admin role required");
  }
}

export class FeedbackReviewService {
  private readonly clock: Clock;
  private readonly newId: IdGenerator;

  constructor(private readonly deps: FeedbackServiceDeps) {
    this.clock = deps.clock ?? systemClock;
    this.newId = deps.newId ?? randomId;
  }

  /**
   * Called when a level cycle is completed (TA-025): computes stats, concept and retry
   * eligibility, generates a draft (AI or rules) and enqueues it for teacher review.
   * Idempotent per (student, set, level, cycle).
   */
  async onLevelCompleted(
    tenantId: TenantId,
    input: LevelCompletionInput,
  ): Promise<FeedbackReviewRecord> {
    const key: ReviewKey = {
      studentId: input.studentId,
      setId: input.setId,
      level: input.level,
      levelCycle: input.levelCycle,
    };
    const existing = await this.deps.reviews.findByKey(tenantId, key);
    if (existing) return existing;
    if (input.attempts.some((a) => a.tenantId !== tenantId || a.studentId !== input.studentId)) {
      throw new DomainError("VALIDATION", "Attempts do not belong to this tenant/student");
    }

    let rules: ConceptRules;
    try {
      rules = resolveConceptRules(input.conceptRules);
    } catch (e) {
      throw new DomainError("VALIDATION", "Invalid concept rules", e);
    }
    const stats = computeLevelStats(input.attempts, input.exercises, input.requiredCount);
    const { concept, percent } = computeConcept(stats, rules);
    const retry = canRetryLevel(concept, input.levelCycle, rules);
    const template = resolveTemplate(await this.deps.templates.listForSet(tenantId, input.setId), {
      setId: input.setId,
      level: input.level,
      concept,
    });
    const answerKeys = input.exercises.flatMap((e) =>
      e.content.targets.flatMap((t) => ("formula" in t.expected ? [t.expected.formula] : [])),
    );
    const now = this.clock.now();
    const base: FeedbackReviewRecord = {
      id: this.newId(),
      tenantId,
      ...key,
      concept,
      conceptPercent: percent,
      retry,
      rules,
      stats,
      template,
      answerKeys,
      status: "DRAFT",
      generationStatus: "PENDING",
      generationError: null,
      draft: null,
      finalText: null,
      generations: [],
      final: null,
      finalSource: null,
      reviewerId: null,
      reviewedAt: null,
      rejectionReason: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const generation = await this.generate(base, null);
    return this.deps.reviews.create(tenantId, this.applyGeneration(base, generation));
  }

  private promptInput(r: FeedbackReviewRecord, guidance: string | null): FeedbackPromptInput {
    return {
      level: r.level,
      concept: r.concept,
      conceptPercent: r.conceptPercent,
      retry: r.retry,
      stats: r.stats,
      template: r.template,
      teacherGuidance: guidance,
    };
  }

  private async generate(
    r: FeedbackReviewRecord,
    guidance: string | null,
  ): Promise<DraftGeneration> {
    const number = r.generations.length + 1;
    const createdAt = this.clock.now();
    const input = this.promptInput(r, guidance);
    const ai = this.deps.ai;
    if (!ai) {
      const parsed = feedbackContentSchema.safeParse(buildRulesDraft(input));
      return {
        generation: number,
        source: "RULES",
        provider: null,
        model: null,
        content: parsed.success ? parsed.data : null,
        error: parsed.success ? null : "RULES_TEMPLATE_INVALID",
        warnings: [],
        teacherGuidance: guidance,
        createdAt,
      };
    }
    const fail = (error: string): DraftGeneration => ({
      generation: number,
      source: "AI",
      provider: ai.name,
      model: ai.model,
      content: null,
      error,
      warnings: [],
      teacherGuidance: guidance,
      createdAt,
    });
    try {
      const res = await ai.complete({
        messages: buildFeedbackPrompt(input),
        responseFormat: "json",
        temperature: 0.4,
        maxTokens: 1200,
      });
      const parsed = parseFeedbackOutput(res.content);
      if (!parsed.ok) return { ...fail(`INVALID_OUTPUT: ${parsed.error}`), model: res.model };
      const leaks = findAnswerKeyLeaks(parsed.content, r.answerKeys);
      return {
        ...fail(""),
        error: null,
        model: res.model,
        content: parsed.content,
        warnings: leaks.length ? ["POSSIBLE_ANSWER_KEY_LEAK"] : [],
      };
    } catch (e) {
      return fail(
        e instanceof AiProviderError
          ? `${e.code}${e.options.status ? ` ${e.options.status}` : ""}`
          : "UNKNOWN_ERROR",
      );
    }
  }

  private applyGeneration(r: FeedbackReviewRecord, g: DraftGeneration): FeedbackReviewRecord {
    return {
      ...r,
      status: "DRAFT",
      generationStatus: g.content ? "GENERATED" : "FAILED",
      generationError: g.content ? null : (g.error ?? "UNKNOWN_ERROR"),
      draft: g.content,
      generations: [...r.generations, g],
      rejectionReason: g.content ? null : r.rejectionReason,
    };
  }

  private async load(tenantId: TenantId, id: string): Promise<FeedbackReviewRecord> {
    const r = await this.deps.reviews.findById(tenantId, id);
    if (!r) throw new DomainError("NOT_FOUND", "Feedback review not found");
    return r;
  }

  private assertAction(
    r: FeedbackReviewRecord,
    action: ReviewAction,
    expectedVersion?: number,
  ): void {
    if (expectedVersion !== undefined && expectedVersion !== r.version) {
      throw new DomainError("CONFLICT", "Review was changed by someone else; reload it");
    }
    if (!canTransition(r.status, action)) {
      throw new DomainError("ALREADY_REVIEWED", `Cannot ${action} a review in status ${r.status}`);
    }
  }

  private async save(tenantId: TenantId, prev: FeedbackReviewRecord, next: FeedbackReviewRecord) {
    const saved = await this.deps.reviews.update(tenantId, prev.version, {
      ...next,
      version: prev.version + 1,
      updatedAt: this.clock.now(),
    });
    if (!saved) throw new DomainError("CONFLICT", "Review was changed by someone else; reload it");
    return saved;
  }

  async listQueue(actor: Actor, tenantId: TenantId, filter: ReviewFilter = {}) {
    assertStaff(actor, tenantId);
    const rows = await this.deps.reviews.list(tenantId, {
      ...filter,
      status: filter.status ?? ["DRAFT", "REJECTED"],
    });
    return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getForReview(actor: Actor, tenantId: TenantId, id: string) {
    assertStaff(actor, tenantId);
    return this.load(tenantId, id);
  }

  /**
   * DRAFT | REJECTED → APPROVED. With a non-empty `finalText` the teacher's text is what the
   * student sees (works even when generationStatus = FAILED); without it the GENERATED draft is
   * approved as is (or a finalText saved earlier via `updateFinalText`).
   */
  async approve(
    actor: Actor,
    tenantId: TenantId,
    id: string,
    input: { finalText?: string | null } = {},
    expectedVersion?: number,
  ) {
    assertStaff(actor, tenantId);
    const r = await this.load(tenantId, id);
    this.assertAction(r, "approve", expectedVersion);
    const text = normalizeFinalText(input.finalText) ?? r.finalText;
    let final: FeedbackContent;
    let source: FeedbackSource;
    if (text) {
      final = {
        message: text,
        strengths: r.draft?.strengths ?? [],
        improvements: r.draft?.improvements ?? [],
        nextSteps: r.draft?.nextSteps ?? [],
      };
      source = text === r.draft?.message ? (this.lastSource(r) ?? "PROFESSOR") : "PROFESSOR";
    } else {
      if (r.generationStatus !== "GENERATED" || !r.draft) {
        throw new DomainError(
          "GENERATION_NOT_READY",
          "AI feedback was not generated; write the feedback text (finalText) to approve",
          { generationStatus: r.generationStatus },
        );
      }
      final = r.draft;
      source = this.lastSource(r) ?? "AI";
    }
    return this.save(tenantId, r, {
      ...r,
      status: "APPROVED",
      finalText: text ?? null,
      final,
      finalSource: source,
      reviewerId: actor.userId,
      reviewedAt: this.clock.now(),
    });
  }

  /** PATCH :id {finalText}: saves the teacher's text without approving. */
  async updateFinalText(
    actor: Actor,
    tenantId: TenantId,
    id: string,
    finalText: string | null,
    expectedVersion?: number,
  ) {
    assertStaff(actor, tenantId);
    const r = await this.load(tenantId, id);
    this.assertAction(r, "edit", expectedVersion);
    return this.save(tenantId, r, { ...r, finalText: normalizeFinalText(finalText) });
  }

  /** Structured edit-and-approve (message + lists), validated by the content schema. */
  async editAndApprove(
    actor: Actor,
    tenantId: TenantId,
    id: string,
    content: FeedbackContentInput,
    expectedVersion?: number,
  ) {
    assertStaff(actor, tenantId);
    const r = await this.load(tenantId, id);
    this.assertAction(r, "approve", expectedVersion);
    const parsed = feedbackContentSchema.safeParse(content);
    if (!parsed.success)
      throw new DomainError("VALIDATION", "Invalid feedback content", parsed.error.issues);
    return this.save(tenantId, r, {
      ...r,
      status: "APPROVED",
      finalText: parsed.data.message,
      final: parsed.data,
      finalSource: "PROFESSOR",
      reviewerId: actor.userId,
      reviewedAt: this.clock.now(),
    });
  }

  private lastSource(r: FeedbackReviewRecord): FeedbackSource | null {
    return r.generations[r.generations.length - 1]?.source ?? null;
  }

  async reject(
    actor: Actor,
    tenantId: TenantId,
    id: string,
    reason?: string | null,
    expectedVersion?: number,
  ) {
    assertStaff(actor, tenantId);
    const r = await this.load(tenantId, id);
    this.assertAction(r, "reject", expectedVersion);
    const trimmed = (reason ?? "").trim();
    return this.save(tenantId, r, {
      ...r,
      status: "REJECTED",
      rejectionReason: trimmed ? trimmed.slice(0, 1000) : null,
      reviewerId: actor.userId,
      reviewedAt: this.clock.now(),
    });
  }

  async regenerate(
    actor: Actor,
    tenantId: TenantId,
    id: string,
    guidance?: string | null,
    expectedVersion?: number,
  ) {
    assertStaff(actor, tenantId);
    const r = await this.load(tenantId, id);
    this.assertAction(r, "regenerate", expectedVersion);
    if (r.generations.length >= MAX_GENERATIONS) {
      throw new DomainError(
        "NOT_ALLOWED",
        `Generation limit (${MAX_GENERATIONS}) reached; write the text and approve instead`,
      );
    }
    const g = await this.generate(r, guidance?.trim().slice(0, 1000) || null);
    return this.save(tenantId, r, this.applyGeneration(r, g));
  }

  /** Approved feedback only. Students can read only their own. */
  async getStudentFeedback(
    actor: Actor,
    tenantId: TenantId,
    studentId: UserId,
    filter: { setId?: string; level?: KnowledgeLevel } = {},
  ): Promise<StudentFeedbackView[]> {
    if (actor.tenantId !== tenantId)
      throw new DomainError("FORBIDDEN", "Cross-tenant access denied");
    if (actor.role === "ALUNO" && actor.userId !== studentId) {
      throw new DomainError("FORBIDDEN", "Students can only read their own feedback");
    }
    const rows = await this.deps.reviews.list(tenantId, {
      ...filter,
      studentId,
      status: [...VISIBLE_TO_STUDENT],
    });
    return rows
      .filter((r) => r.final && r.reviewedAt)
      .sort((a, b) => a.reviewedAt!.getTime() - b.reviewedAt!.getTime())
      .map((r) => ({
        setId: r.setId,
        level: r.level,
        levelCycle: r.levelCycle,
        concept: r.concept,
        conceptPercent: r.conceptPercent,
        canRetry: r.retry.allowed,
        content: r.final!,
        approvedAt: r.reviewedAt!,
      }));
  }
}
