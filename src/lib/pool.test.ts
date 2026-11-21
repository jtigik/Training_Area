import { describe, expect, it } from "vitest";

import { drawFromPool, levelPoolWhere } from "./pool";

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
