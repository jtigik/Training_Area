import { describe, expect, it } from "vitest";
import {
  columnLabel,
  inferAnswer,
  moveFocus,
  normalizeGrid,
  parseAddress,
  toAddress,
  validateAnswers,
} from "./grid";

describe("grid helpers", () => {
  it("converte endereços", () => {
    expect(columnLabel(0)).toBe("A");
    expect(toAddress(0, 0)).toBe("A1");
    expect(toAddress(11, 2)).toBe("C12");
    expect(parseAddress("c12")).toEqual({ row: 11, col: 2 });
    expect(parseAddress("A0")).toBeNull();
    expect(parseAddress("AA1")).toBeNull();
  });

  it("navega presa aos limites", () => {
    const g = { rows: 3, cols: 3 };
    expect(moveFocus(0, 0, "up", g)).toEqual({ row: 0, col: 0 });
    expect(moveFocus(2, 2, "right", g)).toEqual({ row: 2, col: 2 });
    expect(moveFocus(1, 1, "down", g)).toEqual({ row: 2, col: 1 });
  });

  it("remove células vazias e fora da grade", () => {
    const g = normalizeGrid({
      rows: 2,
      cols: 2,
      cells: {
        A1: { value: "1", locked: true },
        B1: { value: " ", locked: false },
        C3: { value: "x", locked: false },
      },
    });
    expect(Object.keys(g.cells)).toEqual(["A1"]);
  });

  it("valida gabarito", () => {
    const grid = { rows: 3, cols: 3, cells: { A1: { value: "1", locked: true } } };
    expect(validateAnswers(grid, {})[0].message).toMatch(/pelo menos uma/);
    expect(validateAnswers(grid, { A2: { kind: "VALUE", expected: "" } })).toHaveLength(1);
    expect(
      validateAnswers(grid, { A2: { kind: "FORMULA", expected: "SOMA(A1)" } })[0].message,
    ).toMatch(/"="/);
    expect(validateAnswers(grid, { D9: { kind: "VALUE", expected: "1" } })[0].message).toMatch(
      /fora/,
    );
    expect(validateAnswers(grid, { A1: { kind: "VALUE", expected: "1" } })[0].message).toMatch(
      /bloqueada/,
    );
    expect(validateAnswers(grid, { A2: { kind: "FORMULA", expected: "=A1*2" } })).toEqual([]);
  });

  it("infere tipo do gabarito", () => {
    expect(inferAnswer("  ")).toBeNull();
    expect(inferAnswer("=SOMA(A1:A3)")).toEqual({ kind: "FORMULA", expected: "=SOMA(A1:A3)" });
    expect(inferAnswer("60", { kind: "VALUE", expected: "1", tolerance: 0.5 })).toEqual({
      kind: "VALUE",
      expected: "60",
      tolerance: 0.5,
    });
  });
});
