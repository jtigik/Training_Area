import { describe, expect, it } from "vitest";

import { drawByDifficulty, drawFromPool, levelPoolWhere } from "./pool";

describe("levelPoolWhere", () => {
  it("filtra publicados pelo nível e dificuldades do conjunto", () => {
    expect(levelPoolWhere("FUNDAMENTAL", ["EASY", "MEDIUM"])).toEqual({
      status: "PUBLISHED",
      level: "FUNDAMENTAL",
      difficulty: { in: ["EASY", "MEDIUM"] },
    });
  });

  it("restringe a uma dificuldade só se ela pertence ao conjunto", () => {
    expect(levelPoolWhere("FUNDAMENTAL", ["EASY", "MEDIUM"], "EASY").difficulty).toEqual({
      in: ["EASY"],
    });
    expect(levelPoolWhere("FUNDAMENTAL", ["EASY"], "HARD").difficulty).toEqual({ in: [] });
  });
});

describe("drawFromPool", () => {
  it("sorteia sem repetir e respeita a cota", () => {
    const pool = ["a", "b", "c", "d", "e"];
    const drawn = drawFromPool(pool, 3);
    expect(drawn).toHaveLength(3);
    expect(new Set(drawn).size).toBe(3);
    expect(drawn.every((x) => pool.includes(x))).toBe(true);
  });

  it("cota maior que o pool devolve o pool inteiro; cota 0 devolve vazio", () => {
    expect(drawFromPool(["a", "b"], 5).sort()).toEqual(["a", "b"]);
    expect(drawFromPool(["a"], 0)).toEqual([]);
  });

  it("é determinístico com random injetado", () => {
    expect(drawFromPool(["a", "b", "c"], 2, () => 0)).toEqual(["a", "b"]);
  });
});

describe("drawByDifficulty", () => {
  const items = [
    ...["e1", "e2", "e3", "e4"].map((id) => ({ id, difficulty: "EASY" as const })),
    ...["m1", "m2"].map((id) => ({ id, difficulty: "MEDIUM" as const })),
    { id: "h1", difficulty: "HARD" as const },
  ];

  it("respeita a cota de cada dificuldade, em blocos na ordem dada", () => {
    const { drawn, shortfalls } = drawByDifficulty(items, [
      { difficulty: "EASY", quantity: 3 },
      { difficulty: "MEDIUM", quantity: 2 },
      { difficulty: "HARD", quantity: 1 },
    ]);
    expect(drawn.map((d) => d.difficulty)).toEqual([
      "EASY",
      "EASY",
      "EASY",
      "MEDIUM",
      "MEDIUM",
      "HARD",
    ]);
    expect(new Set(drawn.map((d) => d.id)).size).toBe(6);
    expect(shortfalls).toEqual([]);
  });

  it("falta no pool: usa o que houver e registra a falta; cota 0 não sorteia", () => {
    const { drawn, shortfalls } = drawByDifficulty(items, [
      { difficulty: "EASY", quantity: 0 },
      { difficulty: "HARD", quantity: 3 },
      { difficulty: "VERY_HARD", quantity: 1 },
    ]);
    expect(drawn.map((d) => d.id)).toEqual(["h1"]);
    expect(shortfalls).toEqual([
      { difficulty: "HARD", required: 3, available: 1 },
      { difficulty: "VERY_HARD", required: 1, available: 0 },
    ]);
  });
});
