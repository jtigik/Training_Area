import { gradeSubmission } from "@/lib/formula/check";
import type { StudentApi } from "../client";
import { SESSION_COOKIE } from "../session";
import {
  ApiError,
  DIFFICULTY_LABELS,
  LEVEL_ORDER,
  type AttemptResult,
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
}

const STORAGE_KEY = "ta.mock.v1";
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
  return { id: user.id, name: user.name, email: user.email, role: user.role };
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

function levelStatus(state: MockState, level: KnowledgeLevel): LevelStatus {
  const index = LEVEL_ORDER.indexOf(level);
  if (state.completedAt[level]) return "COMPLETED";
  if (index > 0 && !state.completedAt[LEVEL_ORDER[index - 1]]) return "LOCKED";
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

/** Default bands (TA-027 "conjunto padrão da plataforma"). */
const BANDS = [
  { min: 81, label: "Excelente", range: "entre 81% e 100%" },
  { min: 51, label: "Bom", range: "entre 51% e 80%" },
  { min: 0, label: "Em desenvolvimento", range: "até 50%" },
];

function bandParagraphs(
  name: string,
  label: string,
  correct: number,
  total: number,
  missed: string[],
): string[] {
  const first = name.split(" ")[0];
  const intro =
    label === "Excelente"
      ? `${first}, excelente desempenho: você acertou ${correct} de ${total} exercícios e mostrou domínio das fórmulas deste nível.`
      : label === "Bom"
        ? `${first}, você construiu uma base sólida: acertou ${correct} de ${total} exercícios.`
        : `${first}, você concluiu o nível, mas acertou ${correct} de ${total} exercícios. Vale revisar o conteúdo com calma antes de seguir.`;
  const review =
    missed.length > 0
      ? `O ponto de atenção ficou em: ${missed.join(", ")}. Releia a seção recomendada e tente de novo — a prática faz diferença.`
      : "Você não deixou nenhum exercício sem acerto. Continue assim no próximo nível!";
  return [intro, review];
}

function buildFeedback(state: MockState, level: KnowledgeLevel): LevelFeedback {
  const completedAt = state.completedAt[level];
  if (!completedAt)
    throw new ApiError(404, "LEVEL_NOT_COMPLETED", "Este nível ainda não foi concluído.");
  const user = requireStudent(state);
  const def = levelDef(level);
  const items = def.exerciseIds
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
  const total = items.length;
  const correct = items.filter((i) => i.correct).length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  const band = BANDS.find((b) => percent >= b.min)!;
  const missed = items.filter((i) => !i.correct).map((i) => i.title);
  const nextIndex = LEVEL_ORDER.indexOf(level) + 1;
  const next = MOCK_LEVELS[nextIndex];
  const difficulties = [...new Set(items.map((i) => i.difficulty))] as Difficulty[];
  const firstMissed = def.exerciseIds
    .map((id) => findExercise(id)!)
    .find((e) => missed.includes(e.title));
  const recommended = MOCK_SECTIONS.find((s) => s.id === (firstMissed?.relatedSectionId ?? ""));
  return {
    level,
    completedAt,
    score: { correct, total, percent },
    attempts: items.reduce((n, i) => n + i.attempts, 0),
    difficultiesPracticed: difficulties,
    band: {
      label: band.label,
      range: band.range,
      paragraphs: bandParagraphs(user.name, band.label, correct, total, missed),
    },
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
  async login({ email, password }) {
    await delay();
    const user = MOCK_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.password !== password) {
      // Generic message: never reveal whether the e-mail exists (TA-001).
      throw new ApiError(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
    }
    save({ ...load(), userId: user.id });
    setSessionCookie(`mock-${user.id}`);
    return requireUser(load());
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
};
