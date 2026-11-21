import { SheetEngine, unsupportedFunctions, type CellMap, type EvaluatedValue } from "./engine";
import { normalizeFormula } from "./translate";

/** Answer key as stored by Backend 2 (value only; formula keys are resolved server-side). */
export type ExpectedValue = number | string | boolean;

export interface GradeOptions {
  numberTolerance?: number;
  caseInsensitive?: boolean;
  /** Accept a plain constant instead of a formula. Default false. */
  allowConstants?: boolean;
}

export type GradeCode =
  | "CORRECT"
  | "WRONG_VALUE"
  | "WRONG_TYPE"
  | "UNSUPPORTED_FUNCTION"
  | "HARDCODED_VALUE"
  | "FORMULA_REQUIRED"
  | "FORMULA_ERROR"
  | "PARSE_ERROR"
  | "EMPTY_SUBMISSION";

export interface GradeResult {
  correct: boolean;
  code: GradeCode;
  actual: EvaluatedValue;
}

export const DEFAULT_TOLERANCE = 1e-9;

export function valueMatches(
  actual: EvaluatedValue,
  expected: ExpectedValue,
  { numberTolerance = DEFAULT_TOLERANCE, caseInsensitive = false }: GradeOptions = {},
): boolean {
  if (typeof expected === "number") {
    return actual.kind === "number" && Math.abs(actual.value - expected) <= numberTolerance;
  }
  if (typeof expected === "boolean") {
    return actual.kind === "boolean" && actual.value === expected;
  }
  if (actual.kind !== "text") return false;
  const a = actual.value.trim();
  const e = expected.trim();
  return caseInsensitive ? a.toLocaleLowerCase("pt-BR") === e.toLocaleLowerCase("pt-BR") : a === e;
}

function sameType(actual: EvaluatedValue, expected: ExpectedValue): boolean {
  const map = { number: "number", string: "text", boolean: "boolean" } as const;
  return actual.kind === map[typeof expected as "number" | "string" | "boolean"];
}

const CELL_REF_RE = /\$?[A-Za-z]{1,3}\$?[0-9]+/;

/**
 * Grade a submission for `targetCell` on top of the initial sheet. Value-based,
 * mirroring the rules of Backend 2's gradeSubmission (src/server/grading) so the
 * mock and the live preview agree with the server. The server stays authoritative.
 */
export function gradeSubmission(
  sheet: CellMap,
  targetCell: string,
  submission: string,
  expected: ExpectedValue,
  options: GradeOptions = {},
): GradeResult {
  const text = submission.trim();
  if (text === "") return { correct: false, code: "EMPTY_SUBMISSION", actual: { kind: "empty" } };
  const isFormula = text.startsWith("=");
  if (!isFormula && !options.allowConstants) {
    return { correct: false, code: "FORMULA_REQUIRED", actual: { kind: "empty" } };
  }
  if (isFormula && unsupportedFunctions(text).length > 0) {
    return { correct: false, code: "UNSUPPORTED_FUNCTION", actual: { kind: "empty" } };
  }
  const engine = new SheetEngine(sheet);
  try {
    const actual = engine.preview(targetCell, text);
    if (actual.kind === "error") {
      return {
        correct: false,
        code: actual.code === "#ERRO!" ? "PARSE_ERROR" : "FORMULA_ERROR",
        actual,
      };
    }
    if (
      isFormula &&
      !options.allowConstants &&
      !CELL_REF_RE.test(stripStrings(normalizeFormula(text)))
    ) {
      return { correct: false, code: "HARDCODED_VALUE", actual };
    }
    if (!sameType(actual, expected)) return { correct: false, code: "WRONG_TYPE", actual };
    const ok = valueMatches(actual, expected, options);
    return { correct: ok, code: ok ? "CORRECT" : "WRONG_VALUE", actual };
  } finally {
    engine.destroy();
  }
}

function stripStrings(formula: string): string {
  return formula.replace(/"(?:[^"]|"")*"/g, '""');
}
