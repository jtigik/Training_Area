import { describe, expect, it } from "vitest";
import { displayValue, evaluateFormula, sameValue } from "./formula";

const cells: Record<string, string> = { A1: "10", A2: "20", A3: "30", B1: "=A1*2", C1: "texto" };
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

  it("erros viram códigos do Excel", () => {
    expect(displayValue("=A1/0", lookup)).toBe("#DIV/0!");
    expect(displayValue("=FOO(A1)", lookup)).toBe("#NOME?");
    expect(displayValue("=C1*2", lookup)).toBe("#VALOR!");
  });
});

describe("sameValue", () => {
  it("compara pelo resultado, não pelo texto", () => {
    expect(sameValue("=SUM(A1:A3)", "=SOMA(A1:A3)", lookup)).toBe(true);
    expect(sameValue("60", "=SOMA(A1:A3)", lookup)).toBe(true);
    expect(sameValue("=SOMA(A1:A2)", "=SOMA(A1:A3)", lookup)).toBe(false);
    expect(sameValue("59.5", "60", lookup, 0.5)).toBe(true);
  });
});
