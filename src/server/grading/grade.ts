import { DetailedCellError, HyperFormula } from "hyperformula";
import { analyzeFormula } from "./analysis";
import { DEFAULT_SHEET_NAME, hyperFormulaConfig, resolveLimits } from "./config";
import { canonicalFunctionName, isKnownFunction } from "./functions";
import { GradingFailure, parseA1, toSheetArray, type CellPosition } from "./sheet";
import { normalizeFormula, type NormalizedFormula } from "./tokenizer";
import type {
  EvaluationResult,
  ExerciseDefinition,
  ExerciseValidationResult,
  FeedbackCode,
  GradingError,
  GradingLimits,
  GradingOptions,
  GradingResult,
  ScalarValue,
  SheetData,
  StudentGradingResult,
  ValueType,
} from "./types";
import {
  compareValues,
  literalEqualsExpected,
  parseConstant,
  resolveExpectedValue,
  typeOfValue,
} from "./values";

const now = (): number => globalThis.performance?.now?.() ?? Date.now();

const unique = (xs: Iterable<string>): string[] => [...new Set(xs)].sort();

interface Context {
  limits: GradingLimits;
  sheetName: string;
  options: GradingOptions;
  allowed: ReadonlySet<string> | null;
}

function makeContext(options: GradingOptions = {}): Context {
  return {
    limits: resolveLimits(options.limits),
    sheetName: options.sheetName ?? DEFAULT_SHEET_NAME,
    options,
    allowed: options.allowedFunctions
      ? new Set(options.allowedFunctions.map(canonicalFunctionName))
      : null,
  };
}

function unsupportedOf(functions: string[], ctx: Context): string[] {
  return unique(
    functions.filter((f) => !isKnownFunction(f) || (ctx.allowed !== null && !ctx.allowed.has(f))),
  );
}

function failureToError(e: unknown): GradingError {
  if (e instanceof GradingFailure) return { kind: e.kind, code: e.code, message: e.message };
  if (e instanceof RangeError) return { kind: "LIMIT", code: "RESOURCE_LIMIT", message: e.message };
  return {
    kind: "INTERNAL",
    code: "INTERNAL_ERROR",
    message: e instanceof Error ? e.message : String(e),
  };
}

interface Prepared {
  data: ReturnType<typeof toSheetArray>;
  target: CellPosition;
}

function prepare(exercise: ExerciseDefinition, ctx: Context): Prepared {
  if (!exercise || typeof exercise !== "object") {
    throw new GradingFailure("EXERCISE", "INVALID_EXERCISE", "Exercise definition is required");
  }
  const target = parseA1(String(exercise.targetCell ?? ""));
  if (!target)
    throw new GradingFailure(
      "EXERCISE",
      "INVALID_TARGET",
      `Invalid target cell: ${exercise.targetCell}`,
    );
  if (target.row >= ctx.limits.maxRows || target.col >= ctx.limits.maxColumns) {
    throw new GradingFailure(
      "LIMIT",
      "TARGET_OUT_OF_BOUNDS",
      "Target cell is outside the allowed sheet area",
    );
  }
  return { data: toSheetArray(exercise.sheet, ctx.limits), target };
}

interface RawEvaluation {
  value: ScalarValue | null;
  type: ValueType | null;
  errors: GradingError[];
  referencesCells: boolean;
}

/** Evaluates an already-normalised formula in the target cell of a fresh, isolated HyperFormula instance. */
function evaluateNormalized(prepared: Prepared, formula: string, ctx: Context): RawEvaluation {
  const hf = HyperFormula.buildFromSheets(
    { [ctx.sheetName]: prepared.data },
    hyperFormulaConfig(ctx.limits),
  );
  try {
    if (!hf.validateFormula(formula)) {
      return {
        value: null,
        type: null,
        errors: [{ kind: "PARSE", code: "PARSE_ERROR", message: "Formula could not be parsed" }],
        referencesCells: false,
      };
    }
    const sheet = hf.getSheetId(ctx.sheetName)!;
    const address = { sheet, row: prepared.target.row, col: prepared.target.col };
    hf.setCellContents(address, [[formula]]);
    const raw = hf.getCellValue(address);
    const referencesCells = hf.getCellPrecedents(address).length > 0;

    if (raw instanceof DetailedCellError) {
      return {
        value: raw.value,
        type: "error",
        errors: [{ kind: "EXCEL", code: raw.value, message: raw.message || raw.type }],
        referencesCells,
      };
    }
    // Excel shows 0 for a formula pointing at an empty cell.
    const value: ScalarValue = raw === null || raw === undefined ? 0 : (raw as ScalarValue);
    if (typeof value === "string" && value.length > ctx.limits.maxResultStringLength) {
      return {
        value: null,
        type: null,
        errors: [{ kind: "LIMIT", code: "RESULT_TOO_LONG", message: "Result text exceeds limit" }],
        referencesCells,
      };
    }
    return { value, type: typeOfValue(value), errors: [], referencesCells };
  } finally {
    hf.destroy();
  }
}

function checkFormulaLimits(
  formula: string,
  normalized: NormalizedFormula | null,
  ctx: Context,
): void {
  if (formula.length > ctx.limits.maxFormulaLength) {
    throw new GradingFailure("LIMIT", "FORMULA_TOO_LONG", "Formula exceeds maximum length");
  }
  if (normalized && normalized.maxDepth > ctx.limits.maxNestingDepth) {
    throw new GradingFailure("LIMIT", "NESTING_TOO_DEEP", "Formula nesting exceeds limit");
  }
}

/**
 * Evaluates any formula (or constant) in the target cell of the exercise sheet.
 * Used for the answer key, the teacher preview and the student "test" button.
 */
export function evaluateFormula(
  sheet: SheetData,
  targetCell: string,
  formula: string,
  options: GradingOptions = {},
): EvaluationResult {
  const ctx = makeContext(options);
  const empty: EvaluationResult = {
    value: null,
    type: null,
    errors: [],
    usedFunctions: [],
    unsupportedFunctions: [],
    referencesCells: false,
    normalizedFormula: null,
  };
  try {
    const prepared = prepare({ sheet, targetCell, expected: { value: 0 } }, ctx);
    const trimmed = (formula ?? "").trim();
    if (!trimmed.startsWith("=")) {
      checkFormulaLimits(trimmed, null, ctx);
      const value = parseConstant(trimmed);
      return { ...empty, value, type: typeOfValue(value) };
    }
    checkFormulaLimits(trimmed, null, ctx);
    const normalized = normalizeFormula(trimmed, options.locale ?? "auto");
    checkFormulaLimits(trimmed, normalized, ctx);
    const usedFunctions = unique(normalized.functionCalls);
    const ev = evaluateNormalized(prepared, normalized.formula, ctx);
    return {
      ...ev,
      usedFunctions,
      unsupportedFunctions: unsupportedOf(usedFunctions, ctx),
      normalizedFormula: normalized.formula,
    };
  } catch (e) {
    return { ...empty, errors: [failureToError(e)] };
  }
}

interface ResolvedExpected {
  value: ScalarValue;
  unsupported: string[];
  /** Normalised reference formula (answer key or `referenceFormula`), if any. */
  reference: NormalizedFormula | null;
  /** Whether the reference formula references cells (null when there is none). */
  referenceUsesCells: boolean | null;
  referenceVolatile: boolean;
}

function resolveReference(exercise: ExerciseDefinition, formula: string, ctx: Context) {
  const ev = evaluateFormula(exercise.sheet, exercise.targetCell, formula, ctx.options);
  return { ...ev, normalized: normalizeFormula(formula, ctx.options.locale ?? "auto") };
}

function resolveExpected(exercise: ExerciseDefinition, ctx: Context): ResolvedExpected {
  const exp = exercise.expected as { value?: unknown; formula?: unknown } | undefined;
  if (exp && typeof exp.formula === "string") {
    const ev = resolveReference(exercise, exp.formula, ctx);
    if (ev.errors.length > 0 || ev.value === null || ev.type === "error") {
      const detail = ev.errors[0]?.code ?? "no value";
      throw new GradingFailure(
        "EXERCISE",
        "INVALID_EXPECTED_FORMULA",
        `Answer-key formula failed: ${detail}`,
      );
    }
    return {
      value: ev.value,
      unsupported: ev.unsupportedFunctions,
      reference: ev.normalized,
      referenceUsesCells: ev.referencesCells,
      referenceVolatile: ev.usedFunctions.some((f) => VOLATILE_FUNCTIONS.has(f)),
    };
  }
  if (exp && "value" in exp && exp.value !== undefined && exp.value !== null) {
    let value: ScalarValue;
    try {
      value = resolveExpectedValue(exp.value as never);
    } catch (e) {
      throw new GradingFailure("EXERCISE", "INVALID_EXPECTED_VALUE", (e as Error).message);
    }
    if (typeof exercise.referenceFormula === "string" && exercise.referenceFormula.trim()) {
      const ev = resolveReference(exercise, exercise.referenceFormula, ctx);
      return {
        value,
        unsupported: ev.unsupportedFunctions,
        reference: ev.errors.some((e) => e.kind === "PARSE") ? null : ev.normalized,
        referenceUsesCells: ev.referencesCells,
        referenceVolatile: ev.usedFunctions.some((f) => VOLATILE_FUNCTIONS.has(f)),
      };
    }
    return {
      value,
      unsupported: [],
      reference: null,
      referenceUsesCells: null,
      referenceVolatile: false,
    };
  }
  throw new GradingFailure(
    "EXERCISE",
    "MISSING_EXPECTED",
    "Exercise has no expected value or formula",
  );
}

/**
 * Validates an exercise definition before saving/publishing (TA-016 / TA-034):
 * sheet and target are valid, the answer key evaluates without error, uses only
 * supported functions, and grading the answer-key formula itself returns CORRECT.
 */
export function validateExercise(
  exercise: ExerciseDefinition,
  options: GradingOptions = {},
): ExerciseValidationResult {
  const ctx = makeContext(options);
  try {
    prepare(exercise, ctx);
    const { value, unsupported } = resolveExpected(exercise, ctx);
    const errors: GradingError[] = [];
    if (unsupported.length > 0) {
      errors.push({
        kind: "EXERCISE",
        code: "UNSUPPORTED_FUNCTION",
        message: `Answer key uses unsupported functions: ${unsupported.join(", ")}`,
      });
    }
    const exp = exercise.expected as { formula?: string };
    const key = typeof exp.formula === "string" ? exp.formula : exercise.referenceFormula;
    if (typeof key === "string" && key.trim() && errors.length === 0) {
      const sanity = gradeSubmission(exercise, key, options);
      if (!sanity.correct) {
        errors.push({
          kind: "EXERCISE",
          code: "ANSWER_KEY_NOT_ACCEPTED",
          message: `Answer-key formula is rejected by the exercise rules (${sanity.feedbackCode})`,
        });
      }
    }
    return {
      valid: errors.length === 0,
      errors,
      expectedValue: value,
      unsupportedFunctions: unsupported,
    };
  } catch (e) {
    return {
      valid: false,
      errors: [failureToError(e)],
      expectedValue: null,
      unsupportedFunctions: [],
    };
  }
}

/**
 * Grades a student's submission for one exercise. Pure and synchronous: it builds a
 * throw-away HyperFormula instance, never throws, and works on server and browser.
 * Any formula whose value matches the answer key is accepted, subject to the
 * exercise rules (required/forbidden functions, hardcoded values).
 */
export function gradeSubmission(
  exercise: ExerciseDefinition,
  submission: string,
  options: GradingOptions = {},
): GradingResult {
  const started = now();
  const ctx = makeContext(options);
  const result: GradingResult = {
    correct: false,
    feedbackCode: "INVALID_EXERCISE",
    actualValue: null,
    actualType: null,
    expectedValue: null,
    valueMatches: false,
    errors: [],
    usedFunctions: [],
    missingRequiredFunctions: [],
    forbiddenFunctionsUsed: [],
    unsupportedFunctions: [],
    referencesCells: false,
    normalizedFormula: null,
    analysis: null,
    sensitivity: {
      checked: false,
      variations: 0,
      mismatchedVariations: 0,
      perturbedCells: 0,
      skippedReason: "NOT_APPLICABLE",
    },
    elapsedMs: 0,
  };
  const finish = (code: FeedbackCode): GradingResult => {
    result.feedbackCode = code;
    result.correct = code === "CORRECT";
    result.elapsedMs = Math.round((now() - started) * 1000) / 1000;
    return result;
  };

  let prepared: Prepared;
  let resolved: ResolvedExpected;
  try {
    prepared = prepare(exercise, ctx);
    resolved = resolveExpected(exercise, ctx);
    result.expectedValue = resolved.value;
  } catch (e) {
    const err = failureToError(e);
    result.errors.push(err);
    return finish(err.kind === "LIMIT" ? "LIMIT_EXCEEDED" : "INVALID_EXERCISE");
  }
  const expected = result.expectedValue;
  const allowConstants = exercise.allowConstants ?? false;
  const requireRefs =
    exercise.requireCellReference ?? (!allowConstants && (resolved.referenceUsesCells ?? true));
  const text = typeof submission === "string" ? submission.trim() : "";

  if (text === "" || text === "=") return finish("EMPTY_SUBMISSION");
  if (text.length > ctx.limits.maxFormulaLength) {
    result.errors.push({
      kind: "LIMIT",
      code: "FORMULA_TOO_LONG",
      message: "Formula exceeds maximum length",
    });
    return finish("LIMIT_EXCEEDED");
  }

  // Plain constant (no '=').
  if (!text.startsWith("=")) {
    const value = parseConstant(text);
    result.actualValue = value;
    result.actualType = typeOfValue(value);
    const cmp = compareValues(value, expected, exercise);
    result.valueMatches = cmp === "match";
    if (!allowConstants) return finish("FORMULA_REQUIRED");
    return finish(
      cmp === "match" ? "CORRECT" : cmp === "wrong_type" ? "WRONG_TYPE" : "WRONG_VALUE",
    );
  }

  const normalized = normalizeFormula(text, options.locale ?? "auto");
  result.normalizedFormula = normalized.formula;
  result.analysis = analyzeFormula(text, options.locale ?? "auto");
  if (normalized.maxDepth > ctx.limits.maxNestingDepth) {
    result.errors.push({
      kind: "LIMIT",
      code: "NESTING_TOO_DEEP",
      message: "Formula nesting exceeds limit",
    });
    return finish("LIMIT_EXCEEDED");
  }

  const used = unique(normalized.functionCalls);
  result.usedFunctions = used;
  result.unsupportedFunctions = unsupportedOf(used, ctx);

  const required = unique((exercise.requiredFunctions ?? []).map(canonicalFunctionName));
  const missing = required.filter((f) => !used.includes(f));
  const requiredOk =
    required.length === 0 ||
    ((exercise.requiredFunctionsMode ?? "all") === "any"
      ? missing.length < required.length
      : missing.length === 0);
  result.missingRequiredFunctions = requiredOk ? [] : missing;
  const forbidden = unique((exercise.forbiddenFunctions ?? []).map(canonicalFunctionName));
  result.forbiddenFunctionsUsed = forbidden.filter((f) => used.includes(f));

  let ev: RawEvaluation;
  try {
    ev = evaluateNormalized(prepared, normalized.formula, ctx);
  } catch (e) {
    const err = failureToError(e);
    result.errors.push(err);
    return finish(err.kind === "LIMIT" ? "LIMIT_EXCEEDED" : "FORMULA_ERROR");
  }
  result.errors.push(...ev.errors);
  result.actualValue = ev.value;
  result.actualType = ev.type;
  result.referencesCells = ev.referencesCells;

  const cmp =
    ev.type !== null && ev.type !== "error" && ev.value !== null
      ? compareValues(ev.value, expected, exercise)
      : null;
  result.valueMatches = cmp === "match";

  if (ev.errors.some((e) => e.kind === "PARSE")) return finish("PARSE_ERROR");
  if (ev.errors.some((e) => e.kind === "LIMIT")) return finish("LIMIT_EXCEEDED");
  if (result.unsupportedFunctions.length > 0) return finish("UNSUPPORTED_FUNCTION");
  if (result.forbiddenFunctionsUsed.length > 0) return finish("FORBIDDEN_FUNCTION");

  // When the reference formula itself contains a literal equal to the expected value
  // (e.g. `=A1*2` → 2, or `=IF(C1>=60,"Aprovado",…)` → "Aprovado"), that literal is part of
  // the task, not a hardcoded answer, so the check is skipped.
  const isLiteral = (t: { kind: string }) => t.kind === "number" || t.kind === "string";
  const referenceHasAnswerLiteral = (resolved.reference?.tokens ?? []).some(
    (t) => isLiteral(t) && literalEqualsExpected(t as never, expected, exercise),
  );
  const hasLiteralAnswer =
    (exercise.forbidLiteralExpectedValue ?? !allowConstants) &&
    !referenceHasAnswerLiteral &&
    normalized.tokens.some(
      (t) => isLiteral(t) && literalEqualsExpected(t as never, expected, exercise),
    );
  if ((requireRefs && !ev.referencesCells) || hasLiteralAnswer) return finish("HARDCODED_VALUE");

  if (ev.type === "error") return finish("FORMULA_ERROR");
  if (cmp === "wrong_type") return finish("WRONG_TYPE");
  if (cmp !== "match") return finish("WRONG_VALUE");

  if (exercise.sensitivityCheck === false) {
    result.sensitivity.skippedReason = "DISABLED";
  } else if (!resolved.reference) {
    result.sensitivity.skippedReason = "NO_REFERENCE_FORMULA";
  } else if (resolved.referenceVolatile || used.some((f) => VOLATILE_FUNCTIONS.has(f))) {
    result.sensitivity.skippedReason = "VOLATILE_FUNCTION";
  } else {
    result.sensitivity = checkSensitivity(
      prepared,
      normalized.formula,
      resolved.reference.formula,
      exercise,
      ctx,
    );
    if (result.sensitivity.mismatchedVariations > 0) return finish("INPUT_INSENSITIVE");
  }
  if (!requiredOk) return finish("MISSING_REQUIRED_FUNCTION");
  return finish("CORRECT");
}

const VOLATILE_FUNCTIONS = new Set([
  "NOW",
  "TODAY",
  "RAND",
  "RANDBETWEEN",
  "RANDARRAY",
  "OFFSET",
  "INDIRECT",
]);

/**
 * Deterministic perturbations (k = index of the perturbed cell). They keep integers integral
 * and preserve the sign of each input (0 counts as positive), so domain assumptions such as
 * "values are positive" still hold; the third one is non-uniform so relative order can change.
 */
const NUMBER_VARIATIONS: Array<(x: number, k: number) => number> = [
  (x) => (x < 0 ? x - 1 : x + 1),
  (x) => (x < 0 ? 2 * x - 3 : 2 * x + 3),
  (x, k) => (x < 0 ? 3 * x - (k % 4) - 1 : 3 * x + (k % 4) + 1),
];
export const MAX_PERTURBED_CELLS = 2000;

type RawValue = ReturnType<HyperFormula["getCellValue"]>;

function sameOutcome(a: RawValue, b: RawValue, rules: ExerciseDefinition): boolean {
  const aErr = a instanceof DetailedCellError;
  const bErr = b instanceof DetailedCellError;
  if (aErr || bErr) return aErr && bErr && a.value === b.value;
  return compareValues((a ?? 0) as ScalarValue, (b ?? 0) as ScalarValue, rules) === "match";
}

/**
 * Re-evaluates the submission and the reference formula on perturbed copies of the sheet
 * (numbers and booleans only; text, empty cells and formulas are kept) and counts variations
 * where they disagree. Catches formulas that ignore the input, e.g. `=A1*0+60`.
 */
function checkSensitivity(
  prepared: Prepared,
  studentFormula: string,
  referenceFormula: string,
  rules: ExerciseDefinition,
  ctx: Context,
): GradingResult["sensitivity"] {
  const positions: Array<[number, number]> = [];
  prepared.data.forEach((row, r) =>
    row.forEach((v, c) => {
      if (r === prepared.target.row && c === prepared.target.col) return;
      if (typeof v === "number" || typeof v === "boolean") positions.push([r, c]);
    }),
  );
  if (positions.length === 0) {
    return {
      checked: false,
      variations: 0,
      mismatchedVariations: 0,
      perturbedCells: 0,
      skippedReason: "NO_NUMERIC_INPUTS",
    };
  }
  const cells = positions.slice(0, MAX_PERTURBED_CELLS);
  let mismatched = 0;
  NUMBER_VARIATIONS.forEach((fn, i) => {
    const data = prepared.data.map((row) => row.slice());
    cells.forEach(([r, c], k) => {
      const v = data[r]![c];
      if (typeof v === "number") data[r]![c] = fn(v, k);
      else if (typeof v === "boolean" && i === 1) data[r]![c] = !v;
    });
    const hf = HyperFormula.buildFromSheets(
      { [ctx.sheetName]: data },
      hyperFormulaConfig(ctx.limits),
    );
    try {
      const address = {
        sheet: hf.getSheetId(ctx.sheetName)!,
        row: prepared.target.row,
        col: prepared.target.col,
      };
      hf.setCellContents(address, [[studentFormula]]);
      const student = hf.getCellValue(address);
      hf.setCellContents(address, [[referenceFormula]]);
      const reference = hf.getCellValue(address);
      if (!sameOutcome(student, reference, rules)) mismatched += 1;
    } finally {
      hf.destroy();
    }
  });
  return {
    checked: true,
    variations: NUMBER_VARIATIONS.length,
    mismatchedVariations: mismatched,
    perturbedCells: cells.length,
    skippedReason: null,
  };
}

/** Strips server-only fields (answer key, normalised formula) before sending a result to a student. */
export function toStudentResult(result: GradingResult): StudentGradingResult {
  const student: Partial<GradingResult> = { ...result };
  delete student.expectedValue;
  delete student.normalizedFormula;
  return student as StudentGradingResult;
}
