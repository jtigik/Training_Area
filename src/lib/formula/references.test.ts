import { describe, expect, it } from "vitest";
import { referencedCells } from "./references";

const limits = { rows: 10, cols: 6 };

describe("referencedCells", () => {
  it("expands ranges and single references", () => {
    expect([...referencedCells("=SOMA(A1:A3)+B2", limits)].sort()).toEqual([
      "A1",
      "A2",
      "A3",
      "B2",
    ]);
    expect([...referencedCells("=$B$1:C2", limits)].sort()).toEqual(["B1", "B2", "C1", "C2"]);
  });

  it("ignores strings, function names and non-formulas", () => {
    expect([...referencedCells('=SE(A1="B2";1;0)', limits)]).toEqual(["A1"]);
    expect([...referencedCells("=LOG10(A2)", limits)]).toEqual(["A2"]);
    expect(referencedCells("A1", limits).size).toBe(0);
  });

  it("clips to the visible grid", () => {
    expect(referencedCells("=SOMA(A1:Z100)", { rows: 2, cols: 2 }).size).toBe(4);
  });
});
