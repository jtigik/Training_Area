import data from "./formulas.json";

export type Expected = "correct" | "incorrect" | "invalid" | "unsupported" | "fixed_value";

export interface FormulaCase {
  id: string;
  input: string;
  value: number | string | null;
  expected: Expected;
  note: string;
}

export const EXERCISE = data.exercise;
/** Feedback exigido quando o aluno digita um valor fixo em vez de fórmula (PO, 21/11). */
export const FIXED_VALUE_FEEDBACK = data.fixedValueFeedback;
export const FORMULA_CASES = data.cases as FormulaCase[];
export const casesBy = (expected: Expected) => FORMULA_CASES.filter((c) => c.expected === expected);
