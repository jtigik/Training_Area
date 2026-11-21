import { describe, expect, it } from "vitest";
import { gradeSubmission, valueMatches, volatileFunctions } from "./check";

const sheet = { A1: 10, A2: 20, A3: 30, B1: "Aprovado" };

describe("gradeSubmission", () => {
  it("accepts any formula that reaches the expected value (pt-BR or English)", () => {
    for (const f of ["=SOMA(A1:A3)", "=SUM(A1:A3)", "=A1+A2+A3", "=SOMA(A1;A2;A3)"]) {
      expect(gradeSubmission(sheet, "A4", f, 60)).toMatchObject({ correct: true, code: "CORRECT" });
    }
  });

  it("classifies wrong answers", () => {
    expect(gradeSubmission(sheet, "A4", "=SOMA(A1:A2)", 60).code).toBe("WRONG_VALUE");
    expect(gradeSubmission(sheet, "A4", "=B1", 60).code).toBe("WRONG_TYPE");
    expect(gradeSubmission(sheet, "A4", "60", 60).code).toBe("FORMULA_REQUIRED");
    expect(gradeSubmission(sheet, "A4", "=60", 60).code).toBe("HARDCODED_VALUE");
    expect(gradeSubmission(sheet, "A4", "   ", 60).code).toBe("EMPTY_SUBMISSION");
    expect(gradeSubmission(sheet, "A4", "=SOMA(A1:A3", 60).code).toBe("PARSE_ERROR");
    expect(gradeSubmission(sheet, "A4", "=A1/0", 60).code).toBe("FORMULA_ERROR");
    expect(gradeSubmission(sheet, "A4", "=XPTO(A1)", 60).code).toBe("UNSUPPORTED_FUNCTION");
  });

  it("does not treat cell-like text inside strings as a reference", () => {
    expect(gradeSubmission(sheet, "A4", '="A1"', "A1").code).toBe("HARDCODED_VALUE");
  });

  it("allows constants only when configured", () => {
    expect(gradeSubmission(sheet, "A4", "60", 60, { allowConstants: true }).correct).toBe(true);
  });
});

describe("valueMatches", () => {
  it("uses numeric tolerance", () => {
    expect(valueMatches({ kind: "number", value: 7.7501 }, 7.75, { numberTolerance: 0.001 })).toBe(
      true,
    );
    expect(valueMatches({ kind: "number", value: 7.76 }, 7.75, { numberTolerance: 0.001 })).toBe(
      false,
    );
  });

  it("compares text trimmed, optionally case-insensitive", () => {
    expect(valueMatches({ kind: "text", value: " Reprovado " }, "Reprovado")).toBe(true);
    expect(valueMatches({ kind: "text", value: "reprovado" }, "Reprovado")).toBe(false);
    expect(
      valueMatches({ kind: "text", value: "reprovado" }, "Reprovado", { caseInsensitive: true }),
    ).toBe(true);
  });

  it("compares booleans strictly", () => {
    expect(valueMatches({ kind: "boolean", value: true }, true)).toBe(true);
    expect(valueMatches({ kind: "number", value: 1 }, true)).toBe(false);
  });
});

describe("gradeSubmission – limits", () => {
  it("rejects formulas longer than Backend 2's limit (QA F-142)", () => {
    const long = "=A1+A2+A3" + "+0".repeat(1000);
    const r = gradeSubmission({ A1: 10, A2: 20, A3: 30 }, "A4", long, 60);
    expect(r).toMatchObject({ correct: false, code: "LIMIT_EXCEEDED" });
  });
});

describe("volatile functions", () => {
  it("detects RAND/NOW/TODAY and their pt-BR names", () => {
    expect(volatileFunctions("=ALEATÓRIO()*0+60")).toEqual(["RAND"]);
    expect(volatileFunctions("=ALEATÓRIOENTRE(1;2)+HOJE()")).toEqual(["RANDBETWEEN", "TODAY"]);
    expect(volatileFunctions("=agora()")).toEqual(["NOW"]);
    expect(volatileFunctions("=SOMA(A1:A3)")).toEqual([]);
    expect(volatileFunctions("HOJE")).toEqual([]);
  });
  it("grades answers with volatile functions as VOLATILE_FUNCTION", () => {
    const r = gradeSubmission({ A1: 10, A2: 20, A3: 30 }, "A4", "=SOMA(A1:A3)+HOJE()*0", 60);
    expect(r).toMatchObject({ correct: false, code: "VOLATILE_FUNCTION" });
  });

  it('keeps 10 (number) and "10" (text) distinct (TC-036-02)', () => {
    const typed = { A1: 10, A2: "10", A3: "=A1" };
    expect(gradeSubmission(typed, "B1", "=A1", 10).code).toBe("CORRECT");
    expect(gradeSubmission(typed, "B1", "=A2", 10).code).toBe("WRONG_TYPE");
    expect(gradeSubmission(typed, "B1", "=A2", "10").code).toBe("CORRECT");
    expect(gradeSubmission(typed, "B1", "=A1", "10").code).toBe("WRONG_TYPE");
    // A literal "=A1" string is text, not a formula.
    expect(gradeSubmission(typed, "B1", "=A3", "=A1").code).toBe("CORRECT");
  });

  it("uses { f } formula cells from the sheet", () => {
    const withFormula = { A1: 10, A2: 20, A3: { f: "=SOMA(A1:A2)", v: 30 } };
    expect(gradeSubmission(withFormula, "B1", "=A3*2", 60).code).toBe("CORRECT");
  });
});
