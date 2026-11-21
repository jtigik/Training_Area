// @vitest-environment node
import { describe, expect, it } from "vitest";

import { analyzeFormula } from "./analysis";
import { gradeSubmission } from "./grade";

describe("analyzeFormula", () => {
  it("conta funções, referências e intervalos", () => {
    const a = analyzeFormula("=SUM(A1:A3)+SUM(B1:B3)*$C$1");
    expect(a.functions).toEqual([{ name: "SUM", count: 2 }]);
    expect(a.functionCallCount).toBe(2);
    expect(a.references.map((r) => [r.text, r.kind, r.anchor])).toEqual([
      ["A1:A3", "range", "relative"],
      ["B1:B3", "range", "relative"],
      ["$C$1", "cell", "absolute"],
    ]);
    expect(a.rangeCount).toBe(2);
    expect(a.absoluteReferenceCount).toBe(1);
    expect(a.operators).toMatchObject({ arithmetic: 2, total: 2 });
    expect(a.flags.usesAbsoluteReferences).toBe(true);
  });

  it("detecta referências mistas, de coluna, de linha e de outra planilha", () => {
    const a = analyzeFormula("=SUM(A:A)+SUM($1:$1)+A$1+Plan2!B2+'Minha aba'!C3:D4");
    expect(a.references.map((r) => [r.kind, r.anchor, r.sheet])).toEqual([
      ["column-range", "relative", null],
      ["row-range", "absolute", null],
      ["cell", "mixed", null],
      ["cell", "relative", "Plan2"],
      ["range", "relative", "Minha aba"],
    ]);
    expect(a.crossSheetReferenceCount).toBe(2);
  });

  it("lista literais e números fixos (exceto 0 e 1)", () => {
    const a = analyzeFormula('=IF(A1>=60,"Aprovado","Reprovado")*1+0+42');
    expect(a.literals.strings).toEqual(["Aprovado", "Reprovado"]);
    expect(a.literals.numbers).toEqual([60, 1, 0, 42]);
    expect(a.hardcodedNumbers).toEqual([60, 42]);
    expect(a.hardcodedLiteralCount).toBe(4);
    expect(a.operators.comparison).toBe(1);
  });

  it("não conta sinal unário como operador e reconhece &, <>, booleanos", () => {
    const a = analyzeFormula('=-A1+(-B1)&"x"');
    expect(a.operators).toEqual({ arithmetic: 1, comparison: 0, concatenation: 1, total: 2 });
    const b = analyzeFormula("=IF(A1<>B1,VERDADEIRO,FALSE)");
    expect(b.operators.comparison).toBe(1);
    expect(b.literals.booleans).toEqual([true, false]);
  });

  it("calcula profundidade e complexidade", () => {
    expect(analyzeFormula("=A1").complexity).toBe("trivial");
    expect(analyzeFormula("=SUM(A1:A3)").complexity).toBe("simple");
    const nested = analyzeFormula('=IF(A1>90,"A",IF(A1>80,"B",IF(A1>70,"C",IF(A1>60,"D","F"))))');
    expect(nested.maxNestingDepth).toBe(4);
    expect(nested.flags.deepNesting).toBe(true);
    expect(["moderate", "complex"]).toContain(nested.complexity);
    expect(nested.complexityScore).toBeGreaterThan(analyzeFormula("=SUM(A1:A3)").complexityScore);
  });

  it("marca valores fixos e funções voláteis", () => {
    const a = analyzeFormula("=10+20+30");
    expect(a.flags).toMatchObject({ onlyLiterals: true, usesHardcodedNumbers: true });
    expect(analyzeFormula("=TODAY()-A1").volatileFunctions).toEqual(["TODAY"]);
  });

  it("entende pt-BR e ignora conteúdo de strings", () => {
    const a = analyzeFormula('=SOMA(A1;A2;"B3")');
    expect(a.locale).toBe("pt-BR");
    expect(a.uniqueFunctions).toEqual(["SUM"]);
    expect(a.references.map((r) => r.text)).toEqual(["A1", "A2"]);
  });

  it("é incluída no resultado da correção", () => {
    const r = gradeSubmission(
      { sheet: [[1], [2]], targetCell: "A3", expected: { value: 3 } },
      "=A1+A2",
    );
    expect(r.analysis?.referenceCount).toBe(2);
    expect(
      gradeSubmission(
        { sheet: [], targetCell: "A1", expected: { value: 3 }, allowConstants: true },
        "3",
      ).analysis,
    ).toBeNull();
  });
});
