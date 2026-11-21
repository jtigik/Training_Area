import type {
  Attempt,
  Concept,
  Difficulty,
  Exercise,
  ExerciseSet,
  FeedbackBand,
  Level,
  LevelProgress,
  ProgressStatus,
  User,
} from "./types";
import { REDO_CONCEPTS } from "./types";
import { DIFFICULTY_LABELS, LEVEL_LABELS } from "./labels";

/* ------------------------------------------------------------------ */
/* Publicação de conjunto (TA-015 / TA-019)                            */
/* ------------------------------------------------------------------ */

export interface PublishIssue {
  level: Level;
  difficulty: Difficulty | null;
  required: number;
  available: number;
  message: string;
}

/** Exercícios publicados disponíveis para um recorte do conjunto. */
export function poolSize(
  set: Pick<ExerciseSet, "difficulties">,
  exercises: Exercise[],
  level: Level,
  difficulty: Difficulty | null,
): number {
  return exercises.filter(
    (e) =>
      e.status === "PUBLISHED" &&
      e.level === level &&
      (difficulty ? e.difficulty === difficulty : set.difficulties.includes(e.difficulty)),
  ).length;
}

/** Lista o que impede a publicação. Vazio = pode publicar. */
export function getPublishIssues(set: ExerciseSet, exercises: Exercise[]): PublishIssue[] {
  const issues: PublishIssue[] = [];
  const own = exercises.filter((e) => e.setId === set.id);
  for (const level of set.levels) {
    const rules = set.quantities.filter((q) => q.level === level);
    if (rules.length === 0) {
      issues.push({
        level,
        difficulty: null,
        required: 0,
        available: poolSize(set, own, level, null),
        message: `Defina a quantidade para o nível ${LEVEL_LABELS[level]}.`,
      });
      continue;
    }
    for (const rule of rules) {
      const available = poolSize(set, own, level, rule.difficulty);
      if (rule.quantity > available) {
        const recorte = rule.difficulty
          ? `${LEVEL_LABELS[level]} / ${DIFFICULTY_LABELS[rule.difficulty]}`
          : LEVEL_LABELS[level];
        issues.push({
          level,
          difficulty: rule.difficulty,
          required: rule.quantity,
          available,
          message: `${recorte}: quantidade ${rule.quantity} maior que os ${available} exercício(s) disponíveis.`,
        });
      }
    }
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* Conceitos ND / ED / D / PD e refazer nível                           */
/* ------------------------------------------------------------------ */

/**
 * Faixas padrão de conceito por taxa de acerto (inclusivas).
 * Pendente de confirmação do PO; o backend é a fonte oficial do conceito.
 */
export const CONCEPT_THRESHOLDS: { concept: Concept; min: number }[] = [
  { concept: "PD", min: 90 },
  { concept: "D", min: 70 },
  { concept: "ED", min: 50 },
  { concept: "ND", min: 0 },
];

export function conceptFor(accuracyPercent: number): Concept {
  return CONCEPT_THRESHOLDS.find((t) => accuracyPercent >= t.min)?.concept ?? "ND";
}

/** O aluno pode refazer o nível se a tentativa concluída mais recente teve ND ou ED. */
export function canRedoLevel(progress: Pick<LevelProgress, "status" | "concept">): boolean {
  return (
    progress.status === "COMPLETED" &&
    !!progress.concept &&
    REDO_CONCEPTS.includes(progress.concept)
  );
}

/* ------------------------------------------------------------------ */
/* Faixas de feedback (TA-027)                                          */
/* ------------------------------------------------------------------ */

/** Verifica que as faixas cobrem 0–100 sem lacunas nem sobreposição. */
export function validateBands(bands: Pick<FeedbackBand, "minPercent" | "maxPercent">[]): string[] {
  const errors: string[] = [];
  if (bands.length === 0) return ["Cadastre pelo menos uma faixa."];
  const sorted = [...bands].sort((a, b) => a.minPercent - b.minPercent);
  sorted.forEach((b, i) => {
    if (b.minPercent > b.maxPercent) {
      errors.push(`Faixa ${b.minPercent}–${b.maxPercent}%: mínimo maior que o máximo.`);
    }
    if (i > 0) {
      const prev = sorted[i - 1];
      if (b.minPercent <= prev.maxPercent) {
        errors.push(
          `Faixas ${prev.minPercent}–${prev.maxPercent}% e ${b.minPercent}–${b.maxPercent}% se sobrepõem.`,
        );
      } else if (b.minPercent > prev.maxPercent + 1) {
        errors.push(`Lacuna entre ${prev.maxPercent}% e ${b.minPercent}%.`);
      }
    }
  });
  if (sorted[0].minPercent !== 0) errors.push("A primeira faixa deve começar em 0%.");
  if (sorted[sorted.length - 1].maxPercent !== 100)
    errors.push("A última faixa deve terminar em 100%.");
  return errors;
}

export interface FeedbackVars {
  nome: string;
  nivel: string;
  acertos: number;
  total: number;
}

export function percent(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

export function pickBand<T extends Pick<FeedbackBand, "minPercent" | "maxPercent">>(
  bands: T[],
  pct: number,
): T | undefined {
  return bands.find((b) => pct >= b.minPercent && pct <= b.maxPercent);
}

/** Substitui {{variaveis}} do template; variáveis desconhecidas ficam como estão. */
export function renderTemplate(template: string, vars: FeedbackVars): string {
  const pct = percent(vars.acertos, vars.total);
  const values: Record<string, string> = {
    nome: vars.nome,
    nivel: vars.nivel,
    acertos: String(vars.acertos),
    total: String(vars.total),
    percentual: `${pct}%`,
    conceito: conceptFor(pct),
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) => values[key] ?? whole);
}

export const TEMPLATE_VARIABLES = [
  "nome",
  "nivel",
  "acertos",
  "total",
  "percentual",
  "conceito",
] as const;

/* ------------------------------------------------------------------ */
/* Usuários (TA-002)                                                    */
/* ------------------------------------------------------------------ */

/** Impede rebaixar/desativar o último admin ativo da instituição. */
export function isLastActiveAdmin(users: User[], userId: string): boolean {
  const target = users.find((u) => u.id === userId);
  if (!target || target.role !== "INSTITUTION_ADMIN") return false;
  const admins = users.filter(
    (u) => u.role === "INSTITUTION_ADMIN" && u.active && u.tenantId === target.tenantId,
  );
  return admins.length === 1 && admins[0].id === userId;
}

/** Slug a partir do nome: minúsculas, sem acentos, hífens. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/* ------------------------------------------------------------------ */
/* Resultados (TA-028 / TA-030)                                         */
/* ------------------------------------------------------------------ */

export interface ResultsFilter {
  setId?: string;
  level?: Level;
  difficulty?: Difficulty;
  /** Datas YYYY-MM-DD (America/Sao_Paulo), inclusivas. */
  from?: string;
  to?: string;
  search?: string;
}

/** Converte data local (America/Sao_Paulo, UTC-3) em limite UTC (ms). */
export function dayBoundsUtc(date: string, end: boolean): number {
  const time = end ? "T23:59:59.999-03:00" : "T00:00:00.000-03:00";
  return new Date(`${date}${time}`).getTime();
}

export function filterAttempts<T extends Attempt>(attempts: T[], f: ResultsFilter): T[] {
  const from = f.from ? dayBoundsUtc(f.from, false) : -Infinity;
  const to = f.to ? dayBoundsUtc(f.to, true) : Infinity;
  return attempts.filter((a) => {
    const t = new Date(a.submittedAt).getTime();
    return (
      (!f.setId || a.setId === f.setId) &&
      (!f.level || a.level === f.level) &&
      (!f.difficulty || a.difficulty === f.difficulty) &&
      t >= from &&
      t <= to
    );
  });
}

export interface LevelCell {
  status: ProgressStatus;
  concept: Concept | null;
  levelAttempt: number;
  canRedo: boolean;
}

export interface StudentResultRow {
  student: Pick<User, "id" | "name" | "email">;
  attempts: number;
  correct: number;
  accuracy: number;
  levels: Partial<Record<Level, LevelCell>>;
  lastActivity: string | null;
}

const EMPTY_CELL: LevelCell = {
  status: "NOT_STARTED",
  concept: null,
  levelAttempt: 0,
  canRedo: false,
};

/**
 * Agrega uma linha por aluno — alunos sem tentativas aparecem como
 * "Não iniciado" (TA-028). Com vários conjuntos, mostra o progresso mais avançado.
 */
export function buildStudentRows(
  students: Pick<User, "id" | "name" | "email">[],
  attempts: Attempt[],
  progress: LevelProgress[],
  levels: readonly Level[],
  filter: ResultsFilter = {},
): StudentResultRow[] {
  const filtered = filterAttempts(attempts, filter);
  const term = filter.search?.trim().toLowerCase();
  const rank: Record<ProgressStatus, number> = { NOT_STARTED: 0, IN_PROGRESS: 1, COMPLETED: 2 };
  return students
    .filter(
      (s) => !term || s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term),
    )
    .map((student) => {
      const mine = filtered.filter((a) => a.studentId === student.id);
      const correct = mine.filter((a) => a.correct).length;
      const cells: Partial<Record<Level, LevelCell>> = {};
      for (const level of levels) {
        const best = progress
          .filter(
            (p) =>
              p.studentId === student.id &&
              p.level === level &&
              (!filter.setId || p.setId === filter.setId),
          )
          .sort((a, b) => rank[b.status] - rank[a.status] || b.levelAttempt - a.levelAttempt)[0];
        cells[level] = best
          ? {
              status: best.status,
              concept: best.concept,
              levelAttempt: best.levelAttempt,
              canRedo: canRedoLevel(best),
            }
          : EMPTY_CELL;
      }
      const last = mine.reduce<string | null>(
        (acc, a) => (!acc || a.submittedAt > acc ? a.submittedAt : acc),
        null,
      );
      return {
        student,
        attempts: mine.length,
        correct,
        accuracy: percent(correct, mine.length),
        levels: cells,
        lastActivity: last,
      };
    });
}

/** "dd/mm/aaaa hh:mm" em America/Sao_Paulo. */
export function formatDateTimeBR(iso: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}
