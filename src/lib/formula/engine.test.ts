import { describe, expect, it } from "vitest";
import { formatValue, SheetEngine, unsupportedFunctions } from "./engine";

const cells = { A1: 10, A2: 20, A3: 30.5, B1: { f: "=SOMA(A1:A3)" }, C1: "Texto" };

describe("SheetEngine", () => {
  it("evaluates initial formulas written in pt-BR", () => {
    const e = new SheetEngine(cells);
    expect(e.getValue("B1")).toEqual({ kind: "number", value: 60.5 });
    expect(e.getValue("C1")).toEqual({ kind: "text", value: "Texto" });
    expect(e.getValue("Z99")).toEqual({ kind: "empty" });
    e.destroy();
  });

  it("previews a formula without changing the sheet", () => {
    const e = new SheetEngine(cells);
    expect(e.preview("B2", "=MÉDIA(A1:A2)")).toEqual({ kind: "number", value: 15 });
    expect(e.preview("B2", '=SE(A1>5;"sim";"não")')).toEqual({ kind: "text", value: "sim" });
    expect(e.preview("B2", "=A1>5")).toEqual({ kind: "boolean", value: true });
    expect(e.getValue("B2")).toEqual({ kind: "empty" });
    e.destroy();
  });

  it("recalculates dependents when a cell changes", () => {
    const e = new SheetEngine(cells);
    e.setCell("A1", 100);
    expect(e.getValue("B1")).toEqual({ kind: "number", value: 150.5 });
    e.setTyped("B2", "=B1*2");
    expect(e.snapshot().B2).toEqual({ kind: "number", value: 301 });
    e.destroy();
  });

  it("reports friendly pt-BR errors and never throws", () => {
    const e = new SheetEngine(cells);
    expect(e.preview("B2", "=SOMA(")).toMatchObject({ kind: "error", code: "#ERRO!" });
    expect(e.preview("B2", "=A1/0")).toMatchObject({ kind: "error", code: "#DIV/0!" });
    expect(e.preview("B2", "=DESLOCX(A1)")).toMatchObject({
      kind: "error",
      code: "#NOME?",
      message: expect.stringContaining("não é suportada"),
    });
    expect(e.preview("B2", "=B2+1")).toMatchObject({ kind: "error", code: "#CICLO!" });
    e.destroy();
  });

  it("detects unsupported functions before evaluating", () => {
    expect(unsupportedFunctions("=SOMA(A1)+FOO(1)")).toEqual(["FOO"]);
    expect(unsupportedFunctions("=PROCV(1;A1:B2;2;0)")).toEqual([]);
    expect(unsupportedFunctions("123")).toEqual([]);
  });

  it("formats values for pt-BR display", () => {
    expect(formatValue({ kind: "number", value: 8050 })).toBe("8.050");
    expect(formatValue({ kind: "number", value: 7.25 })).toBe("7,25");
    expect(formatValue({ kind: "boolean", value: false })).toBe("FALSO");
    expect(formatValue({ kind: "error", code: "#N/D", message: "" })).toBe("#N/D");
  });

  it("Backend 2 cell format: formulas only as { f }, strings are literal text", () => {
    const e = new SheetEngine({
      A1: 10,
      A2: "10",
      A3: "=SOMA(A1:A2)",
      A4: { f: "=A1*2", v: 20 },
      A5: true,
      A6: null,
      A7: { f: "=FUNCAOINEXISTENTE(A1)", v: 99 },
    });
    expect(e.getValue("A1")).toEqual({ kind: "number", value: 10 });
    expect(e.getValue("A2")).toEqual({ kind: "text", value: "10" });
    expect(e.getValue("A3")).toEqual({ kind: "text", value: "=SOMA(A1:A2)" });
    expect(e.getValue("A4")).toEqual({ kind: "number", value: 20 });
    expect(e.getValue("A5")).toEqual({ kind: "boolean", value: true });
    expect(e.getValue("A6")).toEqual({ kind: "empty" });
    // Cached `v` is the fallback when the formula can't be computed locally.
    expect(e.getValue("A7")).toEqual({ kind: "number", value: 99 });
    expect(e.snapshot().A7).toEqual({ kind: "number", value: 99 });
    // Typed input keeps spreadsheet semantics, and preview restores literal text cells.
    expect(e.preview("A3", "=A1+1")).toEqual({ kind: "number", value: 11 });
    expect(e.getValue("A3")).toEqual({ kind: "text", value: "=SOMA(A1:A2)" });
    expect(e.preview("B1", "=A2")).toEqual({ kind: "text", value: "10" });
    expect(e.preview("B1", "10")).toEqual({ kind: "number", value: 10 });
    e.destroy();
  });
});
