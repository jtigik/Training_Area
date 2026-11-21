// @vitest-environment node
import { describe, expect, it } from "vitest";

import { gradeMultiCellSubmission } from "./multi";
import { gradeSubmission, validateExercise } from "./grade";
import type { ExerciseDefinition } from "./types";

const sum: ExerciseDefinition = {
  sheet: { A1: 10, A2: 20, A3: 30 },
  targetCell: "A4",
  expected: { formula: "=SUM(A1:A3)" },
  forbidLiteralExpectedValue: false, // isolate the sensitivity check
};

describe("teste de sensibilidade (fórmula que ignora a entrada)", () => {
  it("reprova =A1*0+60 e =A1-A1+60 com INPUT_INSENSITIVE", () => {
    for (const f of ["=A1*0+60", "=A1-A1+60", "=MAX(A1,60)", "=A3*2"]) {
      const r = gradeSubmission(sum, f);
      expect(r.feedbackCode, f).toBe("INPUT_INSENSITIVE");
      expect(r.valueMatches).toBe(true);
      expect(r.sensitivity).toMatchObject({ checked: true, variations: 3 });
      expect(r.sensitivity.mismatchedVariations).toBeGreaterThan(0);
    }
  });

  it("aceita fórmulas equivalentes", () => {
    for (const f of [
      "=SUM(A1:A3)",
      "=A1+A2+A3",
      "=SOMA(A3;A2;A1)",
      "=AVERAGE(A1:A3)*3",
      "=$A$1+A2+A$3",
    ]) {
      const r = gradeSubmission(sum, f);
      expect(r.feedbackCode, f).toBe("CORRECT");
      expect(r.sensitivity).toMatchObject({
        checked: true,
        mismatchedVariations: 0,
        perturbedCells: 3,
      });
    }
  });

  it("detecta coincidências de limite (TRUNC × ROUND) e mantém PROCV equivalente", () => {
    const round: ExerciseDefinition = {
      sheet: { A1: 2.4 },
      targetCell: "B1",
      expected: { formula: "=ROUND(A1,0)" },
    };
    // 2*2.4+3 = 7.8: ROUND → 8, TRUNC → 7
    expect(gradeSubmission(round, "=TRUNC(A1)").feedbackCode).toBe("INPUT_INSENSITIVE");
    expect(gradeSubmission(round, "=ROUND(A1;0)").correct).toBe(true);
    const lookup: ExerciseDefinition = {
      sheet: { E1: 101, F1: 2.5, E2: 102, F2: 4, E3: 103, F3: 7.9, G1: 103 },
      targetCell: "G2",
      expected: { formula: "=VLOOKUP(G1,E1:F3,2,FALSE)" },
    };
    expect(gradeSubmission(lookup, "=INDEX(F1:F3,MATCH(G1,E1:E3,0))").correct).toBe(true);
    expect(gradeSubmission(lookup, "=XLOOKUP(G1,E1:E3,F1:F3)").correct).toBe(true);
  });

  it("textos não são perturbados; lógicos são invertidos", () => {
    const txt: ExerciseDefinition = {
      sheet: { A1: "maria", B1: true },
      targetCell: "C1",
      expected: { formula: '=IF(B1,UPPER(A1),"")' },
    };
    expect(gradeSubmission(txt, '=IF(B1,UPPER(A1),"")').correct).toBe(true);
    expect(gradeSubmission(txt, "=UPPER(A1)").feedbackCode).toBe("INPUT_INSENSITIVE");
  });

  it("é pulado sem fórmula de referência, com funções voláteis ou quando desligado", () => {
    expect(
      gradeSubmission({ ...sum, expected: { value: 60 } }, "=A1+A2+A3").sensitivity.skippedReason,
    ).toBe("NO_REFERENCE_FORMULA");
    expect(
      gradeSubmission(
        { ...sum, expected: { value: 60 }, referenceFormula: "=SUM(A1:A3)" },
        "=A1*0+60",
      ).feedbackCode,
    ).toBe("INPUT_INSENSITIVE");
    expect(gradeSubmission({ ...sum, sensitivityCheck: false }, "=A1*0+60").correct).toBe(true);
    const today: ExerciseDefinition = {
      sheet: { A1: 1 },
      targetCell: "B1",
      expected: { formula: "=TODAY()" },
    };
    const r = gradeSubmission(today, "=TODAY()");
    expect(r.correct).toBe(true);
    expect(r.sensitivity.skippedReason).toBe("VOLATILE_FUNCTION");
  });

  it("gabarito sem referência a células (=TODAY()) passa na autoverificação", () => {
    const today: ExerciseDefinition = {
      sheet: [],
      targetCell: "A1",
      expected: { formula: "=TODAY()" },
    };
    expect(validateExercise(today).valid).toBe(true);
    expect(gradeSubmission(today, "=HOJE()").correct).toBe(true);
    // with a cell-referencing key, a formula without references is still rejected
    expect(gradeSubmission({ ...sum, forbidLiteralExpectedValue: true }, "=60").feedbackCode).toBe(
      "HARDCODED_VALUE",
    );
  });

  it("vale também para exercícios com várias células", () => {
    const r = gradeMultiCellSubmission(
      { sheet: { A1: 10, A2: 20 }, targets: [{ cell: "A3", expected: { formula: "=A1+A2" } }] },
      { A3: "=A1*0+30" },
    );
    expect(r.cells.A3?.feedbackCode).toBe("HARDCODED_VALUE");
    const r2 = gradeMultiCellSubmission(
      {
        sheet: { A1: 10, A2: 20 },
        targets: [
          { cell: "A3", expected: { formula: "=A1+A2" }, forbidLiteralExpectedValue: false },
        ],
      },
      { A3: "=A1*3" },
    );
    expect(r2.cells.A3?.feedbackCode).toBe("INPUT_INSENSITIVE");
  });
});

describe("tipos preservados na planilha", () => {
  it('texto "10" continua texto', () => {
    const ex: ExerciseDefinition = {
      sheet: { A1: "10" },
      targetCell: "B1",
      expected: { value: "10" },
    };
    const r = gradeSubmission(ex, "=A1");
    expect(r).toMatchObject({ actualValue: "10", actualType: "string", correct: true });
    expect(gradeSubmission({ ...ex, expected: { value: true } }, "=ISTEXT(A1)").correct).toBe(true);
    const date: ExerciseDefinition = {
      sheet: { A1: "21/11/2026" },
      targetCell: "B1",
      expected: { value: true },
    };
    expect(gradeSubmission(date, "=ISTEXT(A1)").correct).toBe(true);
    // Excel typing convention: a leading apostrophe marks text and is not part of the value
    const typed: ExerciseDefinition = {
      sheet: { A1: "'10", A2: 20 },
      targetCell: "A3",
      expected: { formula: "=SUM(A1:A2)" },
    };
    expect(gradeSubmission(typed, "=SUM(A1:A2)").expectedValue).toBe(20);
    expect(gradeSubmission(typed, "=A1+A2").feedbackCode).toBe("WRONG_VALUE");
    expect(
      gradeSubmission(
        { sheet: { A1: "'abc" }, targetCell: "B1", expected: { value: "abc" } },
        "=A1",
      ).correct,
    ).toBe(true);
  });
});

describe("aritmética de matriz (Excel 365)", () => {
  it("=SUM(A1:A3*1) e =SUMPRODUCT funcionam sem CSE", () => {
    expect(gradeSubmission(sum, "=SUM(A1:A3*1)").correct).toBe(true);
    expect(gradeSubmission(sum, "=SOMA(A1:A3*1)").correct).toBe(true);
  });
});
