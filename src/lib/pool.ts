import type { Difficulty, KnowledgeLevel } from "@/lib/domain";

/**
 * Pool do nível (MVP, decisão do PO): exercícios PUBLICADOS do tenant + globais
 * com o nível de conhecimento do Level e uma das dificuldades do ExerciseSet,
 * sorteados até a cota por dificuldade (resolveDifficultyQuotas + drawByDifficulty). Fixar exercícios específicos: v1.1.
 * O escopo tenant/global vem do cliente forTenant; aqui só o filtro de conteúdo.
 */
export function levelPoolWhere(
  level: KnowledgeLevel,
  setDifficulties: readonly Difficulty[],
  difficulty?: Difficulty | null,
) {
  const difficulties = difficulty
    ? setDifficulties.filter((d) => d === difficulty)
    : [...setDifficulties];
  return { status: "PUBLISHED" as const, level, difficulty: { in: difficulties } };
}

/** Sorteio sem reposição (Fisher–Yates); `random` injetável para testes. */
export function drawFromPool<T>(
  pool: readonly T[],
  quantity: number,
  random: () => number = Math.random,
): T[] {
  const copy = [...pool];
  const n = Math.max(0, Math.min(quantity, copy.length));
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}

export interface DifficultyShortfall {
  difficulty: Difficulty;
  required: number;
  available: number;
}

/**
 * Sorteio por dificuldade: para cada { difficulty, quantity } (na ordem dada,
 * normalmente da mais fácil para a mais difícil) sorteia até `quantity`
 * candidatos daquela dificuldade. Regra de falta (pool menor que a cota): usa
 * o que houver e registra em `shortfalls`; quem chama decide (EMPTY_POOL só se
 * nada foi sorteado). Resultado em blocos por dificuldade, posição 0..n-1.
 */
export function drawByDifficulty<T extends { difficulty: Difficulty }>(
  candidates: readonly T[],
  quotas: readonly { difficulty: Difficulty; quantity: number }[],
  random: () => number = Math.random,
): { drawn: T[]; shortfalls: DifficultyShortfall[] } {
  const drawn: T[] = [];
  const shortfalls: DifficultyShortfall[] = [];
  for (const { difficulty, quantity } of quotas) {
    if (quantity <= 0) continue;
    const pool = candidates.filter((c) => c.difficulty === difficulty);
    if (pool.length < quantity) {
      shortfalls.push({ difficulty, required: quantity, available: pool.length });
    }
    drawn.push(...drawFromPool(pool, quantity, random));
  }
  return { drawn, shortfalls };
}
