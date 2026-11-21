import { gradeSubmission } from "@/lib/formula/check";
import type { StudentApi } from "../client";
import { SESSION_COOKIE } from "../session";
import {
  ApiError,
  DIFFICULTY_LABELS,
  LEVEL_LABELS,
  type AttemptResult,
  type Concept,
  type Difficulty,
  type ExerciseStatus,
  type KnowledgeLevel,
  type LevelFeedback,
  type LevelProgress,
  type LevelStatus,
  type SessionUser,
  type Trail,
  type TrailLevel,
} from "../types";
import { MOCK_EXERCISES, MOCK_LEVELS, MOCK_SECTIONS, MOCK_USERS, type MockExercise } from "./data";

/**
 * In-browser mock of Backend 1 + Backend 2 for the student area.
 * State lives in localStorage (memory outside the browser) so progress survives reloads.
 */
/** Mock-only knobs (tests/dev). */
export const mockConfig = {
  /** AI feedback stays "em revisão" for this long after completion, then counts as approved. */
  reviewDelayMs: 20_000,
};

interface AttemptLog {
  exerciseId: string;
  submission: string;
  correct: boolean;
  at: string;
}

export interface MockState {
  userId: string | null;
  attempts: AttemptLog[];
  completedAt: Partial<Record<KnowledgeLevel, string>>;
  /** Attempts archived by "Refazer nível". */
  archived?: AttemptLog[];
}

const STORAGE_KEY = "ta.mock.v2";
const LATENCY_MS = process.env.NODE_ENV === "test" ? 0 : 250;

const emptyState = (): MockState => ({ userId: null, attempts: [], completedAt: {} });
let memoryState: MockState = emptyState();

function load(): MockState {
  if (typeof window === "undefined") return memoryState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockState) : emptyState();
  } catch {
    return emptyState();
  }
}

function save(state: MockState) {
  memoryState = state;
  if (typeof window !== "undefined")
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Test/dev helper: reset (or seed) the mock state. */
export function resetMockState(state: MockState = emptyState()) {
  save(state);
}

const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS));

function setSessionCookie(value: string | null) {
  if (typeof document === "undefined") return;
  // Mock only. The real backend sets an httpOnly, Secure, SameSite cookie (TA-033).
  document.cookie = value
    ? `${SESSION_COOKIE}=${value}; path=/; SameSite=Lax`
    : `${SESSION_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
}

function requireUser(state: MockState): SessionUser {
  const user = MOCK_USERS.find((u) => u.id === state.userId);
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Sua sessão expirou. Entre novamente.");
  return user;
}

/** Dev/test helper: sign in as a given mock user (e.g. the teacher, to see the 403 state). */
export function mockSignInAs(userId: string) {
  save({ ...load(), userId });
  setSessionCookie(`mock.${MOCK_USERS.find((u) => u.id === userId)?.role ?? "STUDENT"}.${userId}`);
}

function requireStudent(state: MockState): SessionUser {
  const user = requireUser(state);
  if (user.role !== "STUDENT") {
    throw new ApiError(403, "FORBIDDEN", "Esta área é exclusiva para alunos.");
  }
  return user;
}

const attemptsOf = (state: MockState, id: string) =>
  state.attempts.filter((a) => a.exerciseId === id);

function exerciseStatus(state: MockState, id: string): ExerciseStatus {
  const mine = attemptsOf(state, id);
  if (mine.length === 0) return "NOT_STARTED";
  return mine.some((a) => a.correct) ? "CORRECT" : "INCORRECT";
}

const levelDef = (level: KnowledgeLevel) => MOCK_LEVELS.find((l) => l.level === level)!;
const findExercise = (id: string) => MOCK_EXERCISES.find((e) => e.id === id);

function progressFor(state: MockState, level: KnowledgeLevel): LevelProgress {
  const def = levelDef(level);
  const statuses = def.exerciseIds.slice(0, def.required).map((id) => exerciseStatus(state, id));
  return {
    required: def.required,
    done: statuses.filter((s) => s !== "NOT_STARTED").length,
    correct: statuses.filter((s) => s === "CORRECT").length,
  };
}

const MOCK_ORDER = MOCK_LEVELS.map((l) => l.level);

function levelStatus(state: MockState, level: KnowledgeLevel): LevelStatus {
  const index = MOCK_ORDER.indexOf(level);
  if (state.completedAt[level]) return "COMPLETED";
  if (index > 0 && !state.completedAt[MOCK_ORDER[index - 1]]) return "LOCKED";
  return progressFor(state, level).done > 0 ? "IN_PROGRESS" : "NOT_STARTED";
}

function buildTrail(state: MockState): Trail {
  const levels: TrailLevel[] = MOCK_LEVELS.map((def) => {
    const status = levelStatus(state, def.level);
    return {
      level: def.level,
      description: def.description,
      status,
      progress: progressFor(state, def.level),
      completedAt: state.completedAt[def.level] ?? null,
      concept: state.completedAt[def.level] ? scoreOf(state, def.level).concept : null,
      sections: MOCK_SECTIONS.filter((s) => s.level === def.level).map(summary),
      exercises:
        status === "LOCKED"
          ? []
          : def.exerciseIds.slice(0, def.required).map((id) => {
              const e = findExercise(id)!;
              return {
                id,
                title: e.title,
                difficulty: e.difficulty,
                status: exerciseStatus(state, id),
                attempts: attemptsOf(state, id).length,
              };
            }),
    };
  });
  return {
    set: { id: "set-piloto", name: "Excel do zero ao dashboard (piloto)" },
    levels,
    generalSections: MOCK_SECTIONS.filter((s) => s.level === null).map(summary),
  };
}

function summary({ id, title, order, level, readMinutes }: (typeof MOCK_SECTIONS)[number]) {
  return { id, title, order, level, readMinutes };
}

function requireUnlocked(state: MockState, level: KnowledgeLevel) {
  if (levelStatus(state, level) === "LOCKED") {
    throw new ApiError(403, "LEVEL_LOCKED", "Conclua o nível anterior para liberar este conteúdo.");
  }
}

function getMockExercise(state: MockState, id: string): MockExercise {
  const found = findExercise(id);
  if (!found) throw new ApiError(404, "NOT_FOUND", "Exercício não encontrado.");
  requireUnlocked(state, found.level);
  return found;
}

/** Default concept ranges (assumed; the real rubric comes from the backend). */
export function conceptFor(percent: number): Concept {
  if (percent >= 90) return "PD";
  if (percent >= 70) return "D";
  if (percent >= 50) return "ED";
  return "ND";
}

function itemsOf(state: MockState, level: KnowledgeLevel) {
  const def = levelDef(level);
  return def.exerciseIds
    .slice(0, def.required)
    .map((id) => findExercise(id)!)
    .map((e) => {
      const mine = attemptsOf(state, e.id);
      return {
        exerciseId: e.id,
        title: e.title,
        difficulty: e.difficulty,
        correct: mine.some((a) => a.correct),
        attempts: mine.length,
        lastSubmission: mine.at(-1)?.submission ?? null,
      };
    });
}

function scoreOf(state: MockState, level: KnowledgeLevel) {
  const items = itemsOf(state, level);
  const total = items.length;
  const correct = items.filter((i) => i.correct).length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { items, total, correct, percent, concept: conceptFor(percent) };
}

/** Stand-in for the AI-generated (and teacher-approved) feedback text. */
function aiFeedbackParagraphs(
  name: string,
  percent: number,
  correct: number,
  total: number,
  missed: string[],
) {
  const first = name.split(" ")[0];
  const intro =
    percent >= 90
      ? `${first}, excelente desempenho: você acertou ${correct} de ${total} exercícios (${percent}%) e mostrou domínio das fórmulas deste nível.`
      : percent >= 50
        ? `${first}, você construiu uma base sólida: acertou ${correct} de ${total} exercícios (${percent}%).`
        : `${first}, você concluiu o nível com ${percent}% de acerto (${correct} de ${total}). Vale revisar o conteúdo com calma e refazer o nível.`;
  const review =
    missed.length > 0
      ? `O ponto de atenção ficou em: ${missed.join(", ")}. Releia a seção recomendada antes de seguir.`
      : "Você não deixou nenhum exercício sem acerto. Continue assim no próximo nível!";
  return [intro, review];
}

function buildFeedback(state: MockState, level: KnowledgeLevel): LevelFeedback {
  const completedAt = state.completedAt[level];
  if (!completedAt)
    throw new ApiError(404, "LEVEL_NOT_COMPLETED", "Este nível ainda não foi concluído.");
  const user = requireStudent(state);
  const { items, total, correct, percent, concept } = scoreOf(state, level);
  const missed = items.filter((i) => !i.correct).map((i) => i.title);
  const next = MOCK_LEVELS[MOCK_ORDER.indexOf(level) + 1];
  const firstMissed = items.find((i) => !i.correct);
  const recommended = MOCK_SECTIONS.find(
    (s) =>
      s.id === (firstMissed ? findExercise(firstMissed.exerciseId)?.relatedSectionId : undefined),
  );
  const approvedAtMs = new Date(completedAt).getTime() + mockConfig.reviewDelayMs;
  const published = Date.now() >= approvedAtMs;
  return {
    level,
    completedAt,
    concept,
    status: published ? "PUBLISHED" : "IN_REVIEW",
    score: { correct, total, percent },
    attempts: items.reduce((n, i) => n + i.attempts, 0),
    difficultiesPracticed: [...new Set(items.map((i) => i.difficulty))] as Difficulty[],
    message: published
      ? {
          paragraphs: aiFeedbackParagraphs(user.name, percent, correct, total, missed),
          strengths: items
            .filter((i) => i.correct && i.attempts === 1)
            .map((i) => `${i.title} (${DIFFICULTY_LABELS[i.difficulty]}) na primeira tentativa`),
          toReview: items
            .filter((i) => !i.correct || i.attempts > 1)
            .map((i) =>
              i.correct
                ? `${i.title}: acertou após ${i.attempts} tentativas`
                : `${i.title}: resultado diferente do esperado`,
            ),
          approvedAt: new Date(approvedAtMs).toISOString(),
        }
      : null,
    items,
    nextLevel: next
      ? {
          level: next.level,
          unlocked: true,
          exerciseCount: next.required,
          summary: next.description,
        }
      : null,
    recommendedSection: recommended ? { id: recommended.id, title: recommended.title } : null,
  };
}

export const mockApi: StudentApi = {
  async startLogin(provider) {
    await delay();
    // Mock OAuth: Google/Microsoft both sign in as the demo student.
    void provider;
    const user = MOCK_USERS[0];
    mockSignInAs(user.id);
    return { kind: "signed-in", user };
  },

  async me() {
    await delay();
    return requireUser(load());
  },

  async logout() {
    await delay();
    save({ ...load(), userId: null });
    setSessionCookie(null);
  },

  async getTrail() {
    await delay();
    const state = load();
    requireStudent(state);
    return buildTrail(state);
  },

  async getSection(id) {
    await delay();
    const state = load();
    requireStudent(state);
    const section = MOCK_SECTIONS.find((s) => s.id === id);
    if (!section) throw new ApiError(404, "NOT_FOUND", "Seção não encontrada.");
    if (section.level) requireUnlocked(state, section.level);
    return section;
  },

  async getExercise(id) {
    await delay();
    const state = load();
    requireStudent(state);
    const e = getMockExercise(state, id);
    const def = levelDef(e.level);
    const ids = def.exerciseIds.slice(0, def.required);
    const index = ids.indexOf(id);
    const related = MOCK_SECTIONS.find((s) => s.id === e.relatedSectionId);
    const mine = attemptsOf(state, id);
    return {
      id: e.id,
      level: e.level,
      difficulty: e.difficulty,
      title: e.title,
      statement: e.statement,
      sheet: e.sheet,
      targetCell: e.targetCell,
      relatedSection: related ? { id: related.id, title: related.title } : null,
      status: exerciseStatus(state, id),
      attempts: mine.length,
      lastSubmission: mine.at(-1)?.submission ?? null,
      position: { index, total: ids.length, nextExerciseId: ids[index + 1] ?? null },
    };
  },

  async submitAttempt(id, { submission }): Promise<AttemptResult> {
    await delay();
    const state = load();
    requireStudent(state);
    const e = getMockExercise(state, id);
    // "Server-side" grading against the original sheet (locked cells can't be tampered with).
    const result = gradeSubmission(e.sheet.cells, e.targetCell, submission, e.expected, e.options);
    const countable = result.code !== "EMPTY_SUBMISSION";
    const next: MockState = countable
      ? {
          ...state,
          attempts: [
            ...state.attempts,
            { exerciseId: id, submission, correct: result.correct, at: new Date().toISOString() },
          ],
        }
      : state;
    const progress = progressFor(next, e.level);
    let levelCompleted = false;
    if (!next.completedAt[e.level] && progress.done >= progress.required) {
      next.completedAt = { ...next.completedAt, [e.level]: new Date().toISOString() };
      levelCompleted = true;
    }
    save(next);
    const actual = result.actual;
    return {
      attemptId: `att-${next.attempts.length}`,
      correct: result.correct,
      feedbackCode: result.code,
      actualValue:
        actual.kind === "empty" ? null : actual.kind === "error" ? actual.code : actual.value,
      errors:
        actual.kind === "error"
          ? [{ kind: "EXCEL", code: actual.code, message: actual.message }]
          : [],
      hint: result.correct ? null : e.hint,
      levelProgress: progress,
      levelStatus: levelStatus(next, e.level),
      levelCompleted,
    };
  },

  async getLevelFeedback(level) {
    await delay();
    return buildFeedback(load(), level);
  },

  async retakeLevel(level) {
    await delay();
    const state = load();
    requireStudent(state);
    if (!state.completedAt[level]) {
      throw new ApiError(409, "LEVEL_NOT_COMPLETED", "Este nível ainda não foi concluído.");
    }
    const { concept } = scoreOf(state, level);
    if (concept !== "ND" && concept !== "ED") {
      throw new ApiError(
        409,
        "RETAKE_NOT_ALLOWED",
        `Só é possível refazer níveis com conceito ND ou ED (${LEVEL_LABELS[level]}: ${concept}).`,
      );
    }
    const ids = new Set(levelDef(level).exerciseIds);
    const { [level]: _done, ...completedAt } = state.completedAt;
    void _done;
    save({
      ...state,
      completedAt,
      attempts: state.attempts.filter((a) => !ids.has(a.exerciseId)),
      archived: [...(state.archived ?? []), ...state.attempts.filter((a) => ids.has(a.exerciseId))],
    });
    return buildTrail(load()).levels.find((l) => l.level === level)!;
  },
};
