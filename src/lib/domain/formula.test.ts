import { describe, expect, it } from "vitest";
import { displayValue, evaluateFormula, sameValue } from "./formula";
import type { CellValue } from "./types";

const cells: Record<string, CellValue> = {
  A1: 10,
  A2: 20,
  A3: 30,
  B1: { f: "=A1*2" },
  C1: "texto",
  D1: "10",
  D2: 10,
  D3: "=texto",
  E1: true,
};
const lookup = (a: string) => cells[a];

describe("evaluateFormula", () => {
  it.each([
    ["=SOMA(A1:A3)", 60],
    ["=SUM(A1:A3)", 60],
    ["=A1+A2*2", 50],
    ["=(A1+A2)*2", 60],
    ["=MÉDIA(A1:A3)", 20],
    ["=MAX(A1;A2;5)", 20],
    ["=B1+1", 21],
    ["=CONT.NÚM(A1:C1)", 2],
    ["=2^3", 8],
    ["=-A1", -10],
  ])("%s = %s", (f, v) => expect(evaluateFormula(f, lookup)).toBe(v));

  it("SE e comparação", () => {
    expect(evaluateFormula('=SE(A1>5;"ok";"não")', lookup)).toBe("ok");
  });

  it('TC-036-02: o texto "10" não entra na SOMA; "=texto" literal é texto', () => {
    expect(evaluateFormula("=SOMA(D1:D2)", lookup)).toBe(10);
    expect(evaluateFormula("=CONT.NÚM(D1:D2)", lookup)).toBe(1);
    expect(evaluateFormula("=D3", lookup)).toBe("=texto");
    expect(evaluateFormula("=E1", lookup)).toBe(true);
  });

  it("erros viram códigos do Excel", () => {
    expect(displayValue({ f: "=A1/0" }, lookup)).toBe("#DIV/0!");
    expect(displayValue({ f: "=FOO(A1)" }, lookup)).toBe("#NOME?");
    expect(displayValue({ f: "=C1*2" }, lookup)).toBe("#VALOR!");
  });
});

describe("displayValue", () => {
  it("mostra literais tipados", () => {
    expect(displayValue(10, lookup)).toBe("10");
    expect(displayValue("=texto", lookup)).toBe("=texto");
    expect(displayValue(true, lookup)).toBe("VERDADEIRO");
    expect(displayValue(null, lookup)).toBe("");
  });
});

describe("sameValue", () => {
  it("compara pelo valor calculado", () => {
    expect(sameValue({ f: "=SUM(A1:A3)" }, { f: "=SOMA(A1:A3)" }, lookup)).toBe(true);
    expect(sameValue(60, { f: "=SOMA(A1:A3)" }, lookup)).toBe(true);
    expect(sameValue({ f: "=SOMA(A1:A2)" }, { f: "=SOMA(A1:A3)" }, lookup)).toBe(false);
    expect(sameValue(59.5, 60, lookup, 0.5)).toBe(true);
  });

  it('10 é diferente de "10"', () => {
    expect(sameValue(10, "10", lookup)).toBe(false);
    expect(sameValue("10", "10", lookup)).toBe(true);
    expect(sameValue(true, "TRUE", lookup)).toBe(false);
  });
});
