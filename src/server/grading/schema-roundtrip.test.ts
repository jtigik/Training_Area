// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  apiCellToEngine,
  engineCellToApi,
  fromSchemaExercise,
  gradeMultiCellSubmission,
  toApiStudentSheet,
  toSchemaExercise,
} from "./multi";

// Formato de célula combinado com FE1/FE2/Backend 1:
//   number | string | boolean | null | { f: "=...", v? }

describe("formato de célula da API", () => {
  it("fórmula só existe em { f }; string com '=' é texto literal", () => {
    expect(apiCellToEngine({ f: "=SOMA(A1:A3)" })).toBe("=SOMA(A1:A3)");
    expect(apiCellToEngine({ f: "SOMA(A1:A3)", v: 6 })).toBe("=SOMA(A1:A3)");
    expect(apiCellToEngine("=texto")).toBe("'=texto");
    expect(apiCellToEngine("'apóstrofo")).toBe("''apóstrofo");
    expect(apiCellToEngine("10")).toBe("10");
    expect(apiCellToEngine(10)).toBe(10);
    expect(apiCellToEngine(false)).toBe(false);
    expect(apiCellToEngine(null)).toBeNull();
  });

  it("ida e volta engine ↔ API é estável", () => {
    for (const v of [10, "10", "=texto", "'apóstrofo", true, null, { f: "=A1*2" }] as const) {
      expect(engineCellToApi(apiCellToEngine(v))).toEqual(v);
    }
  });
});

describe("toSchemaExercise / fromSchemaExercise (colunas JSON do Backend 1)", () => {
  it("ida e volta preserva tipos, fórmulas e texto que parece fórmula", () => {
    const schema = toSchemaExercise({
      sheet: { A1: 10, A2: "'10", A3: "=A1*2", B1: "'=texto?", C1: true },
      targets: [{ cell: "A4", expected: { formula: "=SOMA(A1:A3)" }, numberTolerance: 0.01 }],
    });
    expect(schema.initialSheet.cells).toEqual({
      A1: 10,
      A2: "10",
      A3: { f: "=A1*2" },
      B1: "=texto?",
      C1: true,
    });
    expect(schema.expectedResult).toEqual([
      { cell: "A4", formula: "=SOMA(A1:A3)", tolerance: 0.01 },
    ]);
    expect(schema.gradingRules).toBeNull();
    const back = fromSchemaExercise(schema.initialSheet, schema.expectedResult);
    expect(back.sheet).toEqual({ A1: 10, A2: "10", A3: "=A1*2", B1: "'=texto?", C1: true });
    // "10" é texto: SUM ignora → 10 + 20 (A3) = 30
    const r = gradeMultiCellSubmission(back, { A4: "=SUM(A1:A3)" });
    expect(r.correct).toBe(true);
    expect(r.cells.A4?.expectedValue).toBe(30);
  });

  it('TC-036-02: 10 ≠ "10" e "=texto" literal continua texto', () => {
    const ex = fromSchemaExercise({ cells: { A1: "10", A2: 10, A3: "=texto" } }, [
      { cell: "B1", formula: "=SOMA(A1:A2)" },
      { cell: "B2", formula: "=ÉTEXTO(A1)" },
      { cell: "B3", formula: "=A3" },
    ]);
    const r = gradeMultiCellSubmission(ex, { B1: "=SUM(A1:A2)", B2: "=ISTEXT(A1)", B3: "=A3" });
    expect(r.cells.B1?.expectedValue).toBe(10);
    expect(r.cells.B2?.expectedValue).toBe(true);
    expect(r.cells.B3?.expectedValue).toBe("=texto");
    expect(r.correct).toBe(true);
    expect(toApiStudentSheet(ex).cells).toEqual({ A1: "10", A2: 10, A3: "=texto" });
  });

  it("regras por exercício e por célula vão para gradingRules", () => {
    const schema = toSchemaExercise({
      sheet: { A1: 1, A2: 2 },
      targets: [
        { cell: "a3", expected: { formula: "=SOMA(A1:A2)" }, requiredFunctions: ["SUM"] },
        { cell: "A4", expected: { value: 3 } },
      ],
      rules: { allowConstants: false },
    });
    expect(schema.gradingRules).toEqual({
      rules: { allowConstants: false },
      targets: { A3: { requiredFunctions: ["SUM"] } },
    });
    const back = fromSchemaExercise(
      schema.initialSheet,
      schema.expectedResult,
      schema.gradingRules,
    );
    expect(back.rules).toEqual({ allowConstants: false });
    expect(back.targets[0]).toMatchObject({ cell: "A3", requiredFunctions: ["SUM"] });
    expect(gradeMultiCellSubmission(back, { A3: "=A1+A2", A4: "=A1+A2" }).cells.A3?.correct).toBe(
      false,
    );
  });
});
