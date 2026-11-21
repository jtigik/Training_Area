import { DIFFICULTIES, type Difficulty } from "./domain";

/**
 * Cota = quantos exercícios a rodada de um Level sorteia, POR DIFICULDADE
 * (decisão do PO: ex. Fundamental 3 fáceis + 2 médios + 1 difícil; o total do
 * nível é a soma). Camadas: padrão do nível, turma, aluno — todas por dificuldade.
 *
 * Regra por dificuldade do conjunto: aluno > turma (várias turmas: a maior) > padrão.
 * - Se o nível tem QUALQUER cota cadastrada que se aplique ao aluno, dificuldade
 *   sem registro = 0 (não sorteia).
 * - Nível sem nenhuma cota aplicável: DEFAULT_QUOTA_PER_DIFFICULTY em cada
 *   dificuldade do conjunto.
 */
export const DEFAULT_QUOTA_PER_DIFFICULTY = 3;

export type QuotaScope =
  | { kind: "default" }
  | { kind: "classroom"; classroomId: string }
  | { kind: "student"; studentId: string };

/**
 * Chave de unicidade `exercise_quotas.scope_key`. Precisa bater com o CHECK
 * `exercise_quotas_scope_key_consistent` da migração.
 */
export function buildQuotaScopeKey(scope: QuotaScope, difficulty: Difficulty): string {
  const scopePart =
    scope.kind === "default"
      ? "default"
      : scope.kind === "classroom"
        ? `classroom:${scope.classroomId}`
        : `student:${scope.studentId}`;
  return `${scopePart}|${difficulty}`;
}

/** Colunas de escopo correspondentes, para gravar junto com a chave. */
export function quotaScopeColumns(scope: QuotaScope): {
  classroomId: string | null;
  studentId: string | null;
} {
  return {
    classroomId: scope.kind === "classroom" ? scope.classroomId : null,
    studentId: scope.kind === "student" ? scope.studentId : null,
  };
}

export interface QuotaRecord {
  difficulty: Difficulty;
  classroomId: string | null;
  studentId: string | null;
  quantity: number;
}

export interface QuotaQuery {
  studentId: string;
  classroomIds?: readonly string[];
}

export type QuotaSource = "student" | "classroom" | "default" | "fallback" | "none";

export interface DifficultyQuota {
  difficulty: Difficulty;
  quantity: number;
  source: QuotaSource;
}

export interface ResolvedQuota {
  /** Na ordem de DIFFICULTIES; só as dificuldades do conjunto. */
  perDifficulty: DifficultyQuota[];
  total: number;
}

const RANK: Record<"student" | "classroom" | "default", number> = {
  student: 3,
  classroom: 2,
  default: 1,
};

/** Cota efetiva de UM aluno em UM Level, por dificuldade do conjunto. */
export function resolveDifficultyQuotas(
  quotas: readonly QuotaRecord[],
  query: QuotaQuery,
  setDifficulties: readonly Difficulty[],
): ResolvedQuota {
  const classroomIds = new Set(query.classroomIds ?? []);
  const scopeOf = (q: QuotaRecord): "student" | "classroom" | "default" | null => {
    if (q.studentId !== null) return q.studentId === query.studentId ? "student" : null;
    if (q.classroomId !== null) return classroomIds.has(q.classroomId) ? "classroom" : null;
    return "default";
  };

  const best = new Map<
    Difficulty,
    { scope: "student" | "classroom" | "default"; quantity: number }
  >();
  let anyApplicable = false;
  for (const q of quotas) {
    const scope = scopeOf(q);
    if (scope === null) continue;
    anyApplicable = true;
    const current = best.get(q.difficulty);
    if (
      !current ||
      RANK[scope] > RANK[current.scope] ||
      (scope === current.scope && q.quantity > current.quantity)
    ) {
      best.set(q.difficulty, { scope, quantity: q.quantity });
    }
  }

  const wanted = new Set(setDifficulties);
  const perDifficulty = DIFFICULTIES.filter((d) => wanted.has(d)).map((difficulty) => {
    const hit = best.get(difficulty);
    if (hit) return { difficulty, quantity: hit.quantity, source: hit.scope };
    return anyApplicable
      ? { difficulty, quantity: 0, source: "none" as const }
      : { difficulty, quantity: DEFAULT_QUOTA_PER_DIFFICULTY, source: "fallback" as const };
  });
  return { perDifficulty, total: perDifficulty.reduce((sum, d) => sum + d.quantity, 0) };
}
