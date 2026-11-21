import data from "./formulas.json";

export type Expected = "correct" | "incorrect" | "invalid" | "unsupported" | "ambiguous";

export interface FormulaCase {
  id: string;
  input: string;
  value: number | string | null;
  expected: Expected;
  note: string;
}

export const EXERCISE = data.exercise;
export const FORMULA_CASES = data.cases as FormulaCase[];
export const casesBy = (expected: Expected) => FORMULA_CASES.filter((c) => c.expected === expected);
