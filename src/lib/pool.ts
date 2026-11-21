import type { Difficulty, KnowledgeLevel } from "@/lib/domain";

/**
 * Pool do nível (MVP, decisão do PO): exercícios PUBLICADOS do tenant + globais
 * com o nível de conhecimento do Level e uma das dificuldades do ExerciseSet,
 * sorteados até a cota (resolveQuota). Fixar exercícios específicos: v1.1.
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
