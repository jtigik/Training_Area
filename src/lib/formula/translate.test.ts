import { describe, expect, it } from "vitest";
import { normalizeFormula, referencedFunctions, toCanonicalFunctionName } from "./translate";

describe("normalizeFormula", () => {
  it("translates pt-BR function names (with or without accents)", () => {
    expect(normalizeFormula("=SOMA(A1:A3)")).toBe("=SUM(A1:A3)");
    expect(normalizeFormula("=média(A1:A3)")).toBe("=AVERAGE(A1:A3)");
    expect(normalizeFormula("=MEDIA(A1:A3)")).toBe("=AVERAGE(A1:A3)");
    expect(normalizeFormula('=CONT.SE(B2:B7;">=7")')).toBe('=COUNTIF(B2:B7,">=7")');
    expect(normalizeFormula("=PROCV(D2;A2:B5;2;FALSO)")).toBe("=VLOOKUP(D2,A2:B5,2,FALSE())");
  });

  it("keeps English formulas untouched", () => {
    expect(normalizeFormula("=SUM(A1:A3)")).toBe("=SUM(A1:A3)");
    expect(normalizeFormula("=IF(A1>1,1.5,2)")).toBe("=IF(A1>1,1.5,2)");
  });

  it("turns bare booleans into TRUE()/FALSE()", () => {
    expect(normalizeFormula("=SE(VERDADEIRO;1;2)")).toBe("=IF(TRUE(),1,2)");
    expect(normalizeFormula("=IF(TRUE,1,2)")).toBe("=IF(TRUE(),1,2)");
    expect(normalizeFormula("=FALSO()")).toBe("=FALSE()");
  });

  it("uses ; as argument separator and , as decimal mark in pt-BR style", () => {
    expect(normalizeFormula("=ARRED(A1*1,5;2)")).toBe("=ROUND(A1*1.5,2)");
  });

  it("does not touch string literals", () => {
    expect(normalizeFormula('=SE(A1="SOMA(1;2)";"a;b";"c,d")')).toBe(
      '=IF(A1="SOMA(1;2)","a;b","c,d")',
    );
    expect(normalizeFormula('=CONCATENAR("diz ""oi""";B1)')).toBe('=CONCATENATE("diz ""oi""",B1)');
  });

  it("converts pt-BR decimal constants", () => {
    expect(normalizeFormula("1,5")).toBe("1.5");
    expect(normalizeFormula("texto, com vírgula")).toBe("texto, com vírgula");
  });

  it("lists referenced functions outside strings", () => {
    expect(referencedFunctions('=SUM(A1)+IF(B1,"MAX(1)",0)')).toEqual(["SUM", "IF"]);
    expect(toCanonicalFunctionName("procv")).toBe("VLOOKUP");
    expect(toCanonicalFunctionName("unknownfn")).toBe("UNKNOWNFN");
  });
});
