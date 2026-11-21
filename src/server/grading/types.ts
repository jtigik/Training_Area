/**
 * Public types of the formula grading engine (motor de correção).
 *
 * Everything here is plain JSON-serialisable data so an exercise definition can
 * be stored as-is (e.g. in a PostgreSQL `jsonb` column) and the result can be
 * persisted as the attempt's grading payload.
 */

/** Raw content of a cell: a value, or a formula when the string starts with '='. */
export type CellInput = number | string | boolean | null;

/**
 * Initial sheet data. Either a row-major 2D array (`sheet[row][col]`, A1 = [0][0])
 * or a map of A1-style addresses to contents (`{ A1: 10, B1: '=A1*2' }`).
 */
export type SheetData = CellInput[][] | Record<string, CellInput>;

/** Expected date, ISO `YYYY-MM-DD` (optionally `YYYY-MM-DDTHH:MM[:SS]`), compared as an Excel serial. */
export interface ExpectedDate {
  date: string;
}

export type ExpectedValue = number | string | boolean | ExpectedDate;

/** The answer key (gabarito): either a literal value or a formula evaluated on the initial sheet. */
export type ExpectedAnswer = { value: ExpectedValue } | { formula: string };

export interface ExerciseDefinition {
  /** Initial sheet shown to the student. Strings starting with '=' are formulas. */
  sheet: SheetData;
  /** A1-style address of the cell the student must fill, e.g. `"B5"`. */
  targetCell: string;
  /** Answer key. Any submission that evaluates to this value is accepted (subject to the rules below). */
  expected: ExpectedAnswer;
  /** Absolute tolerance for numeric comparison. Default `1e-9`. */
  numberTolerance?: number;
  /** Optional relative tolerance (fraction of |expected|) for numeric comparison. Default `0`. */
  relativeTolerance?: number;
  /** Compare strings ignoring case (pt-BR aware). Default `false`. */
  caseInsensitive?: boolean;
  /** Trim leading/trailing whitespace of string results before comparing. Default `true`. */
  trimStrings?: boolean;
  /** Functions the formula must use (English or pt-BR names, case-insensitive). */
  requiredFunctions?: string[];
  /** `all` (default): every required function must appear; `any`: at least one of them. */
  requiredFunctionsMode?: "all" | "any";
  /** Functions the formula must NOT use. */
  forbiddenFunctions?: string[];
  /** Accept a plain constant (no leading '='). Default `false`. */
  allowConstants?: boolean;
  /** Formula must reference at least one cell/range. Default `!allowConstants`. */
  requireCellReference?: boolean;
  /** Reject formulas containing the expected value as a literal (e.g. `=A1*0+42`). Default `false`. */
  forbidLiteralExpectedValue?: boolean;
}

export type FormulaLocale = "auto" | "en" | "pt-BR";

export interface GradingLimits {
  maxFormulaLength: number;
  maxNestingDepth: number;
  maxRows: number;
  maxColumns: number;
  maxCells: number;
  maxCellTextLength: number;
  maxResultStringLength: number;
}

export interface GradingOptions {
  /**
   * How to read the submission. `auto` (default) treats ';' as argument separator
   * and ',' as decimal separator when the formula uses ';' outside of strings/arrays.
   * Function names are always accepted in English and pt-BR.
   */
  locale?: FormulaLocale;
  /** Allow-list of canonical (English) function names for this instance (MVP supported set). Default: everything HyperFormula supports. */
  allowedFunctions?: readonly string[];
  /** Name of the single worksheet. Default `"Planilha1"`. */
  sheetName?: string;
  /** Override safety limits. */
  limits?: Partial<GradingLimits>;
}

export type FeedbackCode =
  | "CORRECT"
  | "WRONG_VALUE"
  | "WRONG_TYPE"
  | "MISSING_REQUIRED_FUNCTION"
  | "FORBIDDEN_FUNCTION"
  | "UNSUPPORTED_FUNCTION"
  | "HARDCODED_VALUE"
  | "FORMULA_REQUIRED"
  | "FORMULA_ERROR"
  | "PARSE_ERROR"
  | "EMPTY_SUBMISSION"
  | "LIMIT_EXCEEDED"
  | "INVALID_EXERCISE";

export type GradingErrorKind = "PARSE" | "EXCEL" | "LIMIT" | "EXERCISE" | "INTERNAL";

export interface GradingError {
  kind: GradingErrorKind;
  /** For EXCEL errors the Excel literal (`#DIV/0!`, `#REF!`…); otherwise a stable machine code. */
  code: string;
  message: string;
}

export type ScalarValue = number | string | boolean;
export type ValueType = "number" | "string" | "boolean" | "error";

export interface GradingResult {
  correct: boolean;
  feedbackCode: FeedbackCode;
  /** Evaluated value of the submission (Excel error literal when it evaluated to an error). */
  actualValue: ScalarValue | null;
  actualType: ValueType | null;
  /** Resolved expected value. Do NOT send to students; see `toStudentResult`. */
  expectedValue: ScalarValue | null;
  /** True when the evaluated value matches, regardless of function/hardcode rules. */
  valueMatches: boolean;
  errors: GradingError[];
  /** Canonical (English, upper-case) names, sorted and de-duplicated. */
  usedFunctions: string[];
  missingRequiredFunctions: string[];
  forbiddenFunctionsUsed: string[];
  unsupportedFunctions: string[];
  referencesCells: boolean;
  /** Formula actually evaluated (English names, ',' separators), or `null` for constants/early exits. */
  normalizedFormula: string | null;
  elapsedMs: number;
}

export type StudentGradingResult = Omit<GradingResult, "expectedValue" | "normalizedFormula">;

export interface EvaluationResult {
  value: ScalarValue | null;
  type: ValueType | null;
  errors: GradingError[];
  usedFunctions: string[];
  unsupportedFunctions: string[];
  referencesCells: boolean;
  normalizedFormula: string | null;
}

export interface ExerciseValidationResult {
  valid: boolean;
  errors: GradingError[];
  /** Resolved expected value (evaluated when the answer key is a formula). */
  expectedValue: ScalarValue | null;
  /** Functions used by the answer-key formula that are unsupported (TA-034). */
  unsupportedFunctions: string[];
}
