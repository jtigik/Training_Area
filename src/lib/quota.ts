import type { Difficulty } from "./domain";

/**
 * Regras de cota (quantidade de exercícios de um Level) — TA-015/TA-020.
 * Precedência: aluno > turma > padrão do nível; nível+dificuldade > nível.
 */

export type QuotaScope =
  | { kind: "default" }
  | { kind: "classroom"; classroomId: string }
  | { kind: "student"; studentId: string };

/**
 * Chave de unicidade `exercise_quotas.scope_key`. Precisa bater com o CHECK
 * `exercise_quotas_scope_key_consistent` da migração.
 */
export function buildQuotaScopeKey(scope: QuotaScope, difficulty: Difficulty | null): string {
  const scopePart =
    scope.kind === "default"
      ? "default"
      : scope.kind === "classroom"
        ? `classroom:${scope.classroomId}`
        : `student:${scope.studentId}`;
  return `${scopePart}|${difficulty ?? "*"}`;
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
  difficulty: Difficulty | null;
  classroomId: string | null;
  studentId: string | null;
  quantity: number;
}

export interface QuotaQuery {
  /** Nulo = cota do nível inteiro. */
  difficulty?: Difficulty | null;
  studentId: string;
  classroomIds?: readonly string[];
}

/**
 * Resolve a cota efetiva de um aluno a partir das cotas de UM Level.
 * Retorna `null` se nada se aplica. Empate no mesmo escopo (várias turmas):
 * vale a maior quantidade.
 */
export function resolveQuota(quotas: readonly QuotaRecord[], query: QuotaQuery): number | null {
  const difficulty = query.difficulty ?? null;
  const classroomIds = new Set(query.classroomIds ?? []);

  const scopeRank = (q: QuotaRecord): number | null => {
    if (q.studentId !== null) return q.studentId === query.studentId ? 3 : null;
    if (q.classroomId !== null) return classroomIds.has(q.classroomId) ? 2 : null;
    return 1;
  };

  let best: { rank: number; quantity: number } | null = null;
  for (const q of quotas) {
    if (q.difficulty !== null && q.difficulty !== difficulty) continue;
    const scope = scopeRank(q);
    if (scope === null) continue;
    // o escopo pesa mais que a especificidade da dificuldade
    const rank = scope * 2 + (q.difficulty !== null ? 1 : 0);
    if (!best || rank > best.rank || (rank === best.rank && q.quantity > best.quantity)) {
      best = { rank, quantity: q.quantity };
    }
  }
  return best?.quantity ?? null;
}
