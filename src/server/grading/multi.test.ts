// @vitest-environment node
import { describe, expect, it } from "vitest";

import { fromSchemaExercise, gradeMultiCellSubmission, type MultiCellExercise } from "./multi";

const exercise: MultiCellExercise = {
  sheet: [[10], [20], [30]],
  targets: [
    { cell: "A4", expected: { formula: "=SUM(A1:A3)" }, requiredFunctions: ["SUM"] },
    { cell: "A5", expected: { formula: "=A4/3" } },
  ],
};

describe("gradeMultiCellSubmission", () => {
  it("corrige todas as células e permite dependência entre alvos", () => {
    const r = gradeMultiCellSubmission(exercise, { A4: "=SOMA(A1:A3)", a5: "=A4/3" });
    expect(r).toMatchObject({ correct: true, correctCount: 2, totalTargets: 2 });
  });

  it("o gabarito de um alvo usa o gabarito do outro, não a resposta do aluno", () => {
    const r = gradeMultiCellSubmission(exercise, { A4: "=A1", A5: "=A4/3" });
    expect(r.cells.A4?.feedbackCode).toBe("WRONG_VALUE");
    expect(r.cells.A5?.expectedValue).toBe(20);
    expect(r.cells.A5?.feedbackCode).toBe("WRONG_VALUE");
    expect(r.correctCount).toBe(0);
  });

  it("regras por alvo e regras gerais", () => {
    const r = gradeMultiCellSubmission(
      { ...exercise, rules: { forbiddenFunctions: ["AVERAGE"] } },
      { A4: "=A1+A2+A3", A5: "=AVERAGE(A1:A3)" },
    );
    expect(r.cells.A4?.feedbackCode).toBe("MISSING_REQUIRED_FUNCTION");
    expect(r.cells.A5?.feedbackCode).toBe("FORBIDDEN_FUNCTION");
  });

  it("ignora células fora dos alvos e trata alvo vazio", () => {
    const r = gradeMultiCellSubmission(exercise, { A1: "=1000", A4: "=SUM(A1:A3)" });
    expect(r.cells.A4?.correct).toBe(true);
    expect(r.cells.A5?.feedbackCode).toBe("EMPTY_SUBMISSION");
  });
});

describe("fromSchemaExercise (JSON do schema do Backend 1)", () => {
  it("converte initialSheet/expectedResult", () => {
    const ex = fromSchemaExercise(
      { cells: { A1: { value: 2, locked: true }, A2: { value: 3 }, B1: { formula: "=A1*10" } } },
      [
        { cell: "A3", formula: "=SOMA(A1:A2)" },
        { cell: "B2", value: 20.5, tolerance: 0.5 },
      ],
    );
    const r = gradeMultiCellSubmission(ex, { A3: "=A1+A2", B2: "=B1" });
    expect(r.correct).toBe(true);
  });
});

describe("validateMultiCellExercise", () => {
  it("aceita gabaritos válidos e aponta problemas por célula", async () => {
    const { validateMultiCellExercise } = await import("./multi");
    expect(validateMultiCellExercise(exercise)).toMatchObject({
      valid: true,
      expectedValues: { A4: 60, A5: 20 },
    });
    expect(validateMultiCellExercise({ sheet: [], targets: [] }).errors[0]?.code).toBe(
      "NO_TARGETS",
    );
    const dup = validateMultiCellExercise({
      sheet: [],
      targets: [
        { cell: "A1", expected: { value: 1 } },
        { cell: "$A$1", expected: { value: 1 } },
      ],
    });
    expect(dup.errors[0]?.code).toBe("DUPLICATE_TARGET");
    const bad = validateMultiCellExercise({
      ...exercise,
      targets: [{ cell: "A4", expected: { formula: "=A1+A2+A3" }, requiredFunctions: ["SUM"] }],
    });
    expect(bad.errors[0]).toMatchObject({ cell: "A4", code: "ANSWER_KEY_NOT_ACCEPTED" });
  });
});
