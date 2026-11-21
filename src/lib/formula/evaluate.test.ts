import { describe, expect, it } from "vitest";
import { evaluateSheet } from "./evaluate";
describe("evaluateSheet – unsupported functions", () => {
  it("reports an unsupported function even when HyperFormula fails to parse", () => {
    const r = evaluateSheet({ A1: 1 }, "B1", "=LAMBDA(x;x+1)(A1)");
    expect(r.target.kind).toBe("error");
    if (r.target.kind === "error") expect(r.target.message).toMatch(/LAMBDA não é suportada/);
  });
});

describe("evaluateSheet", () => {
  it("evaluates the target and dependent cells", () => {
    const r = evaluateSheet({ A1: 10, A2: 20, B1: "=A3*2" }, "A3", "=SOMA(A1:A2)");
    expect(r.target).toEqual({ kind: "number", value: 30 });
    expect(r.display.B1).toBe("60");
  });
  it("keeps a syntax error on the target without touching the sheet", () => {
    const r = evaluateSheet({ A1: 1 }, "A2", "=SOMA(A1");
    expect(r.target.kind).toBe("error");
    expect(r.display.A1).toBe("1");
  });
});
