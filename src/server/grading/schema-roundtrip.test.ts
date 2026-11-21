// @vitest-environment node
import { describe, expect, it } from "vitest";

import { fromSchemaExercise, gradeMultiCellSubmission, toSchemaExercise } from "./multi";

describe("toSchemaExercise / fromSchemaExercise (colunas JSON do Backend 1)", () => {
  it("ida e volta preserva tipos, fórmulas e texto que parece fórmula", () => {
    const content = {
      sheet: { A1: 10, A2: "'10", A3: "=A1*2", B1: "=texto?", C1: true },
      targets: [{ cell: "A4", expected: { formula: "=SOMA(A1:A3)" }, numberTolerance: 0.01 }],
    };
    const schema = toSchemaExercise({
      ...content,
      sheet: { ...content.sheet, B1: "'=texto?" },
    });
    expect(schema.initialSheet.cells).toMatchObject({
      A1: { value: 10 },
      A2: { value: "10" },
      A3: { formula: "=A1*2" },
      B1: { value: "=texto?" },
      C1: { value: true },
    });
    expect(schema.expectedResult).toEqual([
      { cell: "A4", formula: "=SOMA(A1:A3)", tolerance: 0.01 },
    ]);
    const back = fromSchemaExercise(schema.initialSheet, schema.expectedResult);
    expect(back.sheet).toMatchObject({ A1: 10, A2: "10", A3: "=A1*2", B1: "'=texto?" });
    // "10" is text: SUM ignores it → 10 + 20 (A3) = 30
    const r = gradeMultiCellSubmission(back, { A4: "=SUM(A1:A3)" });
    expect(r.correct).toBe(true);
    expect(r.cells.A4?.expectedValue).toBe(30);
  });
});
