import { evaluateFormula, gradeSubmission, validateExercise } from "./grade";
import { parseA1 } from "./sheet";
import type {
  CellInput,
  ExerciseDefinition,
  ExpectedAnswer,
  GradingOptions,
  GradingResult,
  ScalarValue,
  SheetData,
} from "./types";

/**
 * Multi-cell exercises: one sheet, several target cells (Backend 1's `Exercise.expectedResult`
 * is an array of target cells). Answer-key formulas are resolved on the sheet filled with ALL
 * answer keys (so B5's key may depend on B4's key); the student's submitted cells are placed
 * together, so a target may depend on another target the student filled.
 */

export type GradingRules = Omit<ExerciseDefinition, "sheet" | "targetCell" | "expected">;

export interface ExerciseTarget extends GradingRules {
  cell: string;
  expected: ExpectedAnswer;
}

export interface MultiCellExercise {
  sheet: SheetData;
  targets: ExerciseTarget[];
  /** Rules applied to every target unless overridden on the target. */
  rules?: GradingRules;
}

export interface MultiCellGradingResult {
  /** True when every target is correct. */
  correct: boolean;
  correctCount: number;
  totalTargets: number;
  cells: Record<string, GradingResult>;
}

function toA1Map(sheet: SheetData): Record<string, CellInput> {
  if (!Array.isArray(sheet)) {
    const out: Record<string, CellInput> = {};
    for (const [k, v] of Object.entries(sheet ?? {})) out[k.toUpperCase().replace(/\$/g, "")] = v;
    return out;
  }
  const out: Record<string, CellInput> = {};
  sheet.forEach((row, r) =>
    (row ?? []).forEach((v, c) => {
      if (v === null || v === undefined || v === "") return;
      out[columnName(c) + (r + 1)] = v;
    }),
  );
  return out;
}

export function columnName(col: number): string {
  let n = col + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const canonicalAddress = (a: string): string => a.toUpperCase().replace(/\$/g, "").trim();

/** Resolves each target's expected value on the sheet filled with all answer keys. */
export function resolveTargetExpectations(
  exercise: MultiCellExercise,
  options: GradingOptions = {},
): Record<string, { value: ScalarValue | null; error: string | null }> {
  const keySheet = toA1Map(exercise.sheet);
  for (const t of exercise.targets) {
    const addr = canonicalAddress(t.cell);
    if ("formula" in t.expected) keySheet[addr] = t.expected.formula;
    else delete keySheet[addr];
  }
  const out: Record<string, { value: ScalarValue | null; error: string | null }> = {};
  for (const t of exercise.targets) {
    const addr = canonicalAddress(t.cell);
    if (!("formula" in t.expected)) {
      out[addr] = { value: null, error: null };
      continue;
    }
    const others = { ...keySheet };
    delete others[addr];
    const ev = evaluateFormula(others, addr, t.expected.formula, options);
    out[addr] =
      ev.errors.length > 0 || ev.type === "error"
        ? { value: null, error: ev.errors[0]?.code ?? "ERROR" }
        : { value: ev.value, error: null };
  }
  return out;
}

/**
 * Grades all target cells of a multi-cell exercise. `submission` maps A1 addresses to what
 * the student typed; non-target addresses are ignored (students cannot overwrite given data).
 */
export function gradeMultiCellSubmission(
  exercise: MultiCellExercise,
  submission: Record<string, string>,
  options: GradingOptions = {},
): MultiCellGradingResult {
  const targets = exercise.targets.map((t) => ({ ...t, cell: canonicalAddress(t.cell) }));
  const targetSet = new Set(targets.map((t) => t.cell));
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(submission ?? {})) {
    const addr = canonicalAddress(k);
    if (targetSet.has(addr) && typeof v === "string") answers[addr] = v;
  }
  const expectations = resolveTargetExpectations(exercise, options);
  const base = toA1Map(exercise.sheet);
  for (const addr of targetSet) delete base[addr];

  const cells: Record<string, GradingResult> = {};
  for (const t of targets) {
    const sheet: Record<string, CellInput> = { ...base };
    for (const [addr, typed] of Object.entries(answers)) if (addr !== t.cell) sheet[addr] = typed;
    const resolved = expectations[t.cell];
    const expected: ExpectedAnswer =
      "formula" in t.expected && resolved?.value !== null && resolved?.value !== undefined
        ? { value: resolved.value }
        : t.expected;
    const { cell, expected: _ignored, ...targetRules } = t;
    void _ignored;
    const definition: ExerciseDefinition = {
      ...exercise.rules,
      ...targetRules,
      sheet,
      targetCell: cell,
      expected,
    };
    cells[cell] = gradeSubmission(definition, answers[cell] ?? "", options);
  }
  const correctCount = Object.values(cells).filter((r) => r.correct).length;
  return {
    correct: correctCount === targets.length && targets.length > 0,
    correctCount,
    totalTargets: targets.length,
    cells,
  };
}

// ---------------------------------------------------------------------------
// Adapter for Backend 1's JSON columns (feat/auth-modelo, uncommitted draft):
//   initialSheet:   { cells: { "A1": { value?, formula?, locked? } } }
//   expectedResult: [{ cell: "B4", value?, formula?, tolerance? }]
// ---------------------------------------------------------------------------

export interface SchemaInitialSheet {
  cells: Record<
    string,
    { value?: string | number | boolean | null; formula?: string; locked?: boolean }
  >;
}

export interface SchemaExpectedCell {
  cell: string;
  value?: string | number | boolean | { date: string };
  formula?: string;
  tolerance?: number;
}

export function fromSchemaExercise(
  initialSheet: SchemaInitialSheet,
  expectedResult: SchemaExpectedCell[],
  rules?: GradingRules,
): MultiCellExercise {
  const sheet: Record<string, CellInput> = {};
  for (const [addr, cell] of Object.entries(initialSheet?.cells ?? {})) {
    if (!parseA1(addr)) continue;
    sheet[canonicalAddress(addr)] = cell.formula ?? cell.value ?? null;
  }
  const targets: ExerciseTarget[] = (expectedResult ?? []).map((e) => ({
    cell: e.cell,
    expected: e.formula !== undefined ? { formula: e.formula } : { value: e.value ?? "" },
    ...(e.tolerance !== undefined ? { numberTolerance: e.tolerance } : {}),
  }));
  return { sheet, targets, rules };
}

export interface TargetValidationError {
  cell: string | null;
  code: string;
  message: string;
}

export interface MultiCellValidationResult {
  valid: boolean;
  errors: TargetValidationError[];
  expectedValues: Record<string, ScalarValue | null>;
}

/**
 * Validates a multi-cell exercise before saving/publishing: at least one target, unique valid
 * addresses, every answer key evaluates without error and with supported functions, and grading
 * the answer keys themselves is CORRECT (TA-016 sanity check, TA-034 unsupported functions).
 */
export function validateMultiCellExercise(
  exercise: MultiCellExercise,
  options: GradingOptions = {},
): MultiCellValidationResult {
  const errors: TargetValidationError[] = [];
  const expectedValues: Record<string, ScalarValue | null> = {};
  const targets = exercise?.targets ?? [];
  if (targets.length === 0) {
    errors.push({
      cell: null,
      code: "NO_TARGETS",
      message: "Exercise needs at least one target cell",
    });
    return { valid: false, errors, expectedValues };
  }
  const seen = new Set<string>();
  for (const t of targets) {
    const addr = canonicalAddress(String(t.cell ?? ""));
    if (!parseA1(addr))
      errors.push({ cell: t.cell, code: "INVALID_TARGET", message: "Invalid address" });
    else if (seen.has(addr))
      errors.push({ cell: addr, code: "DUPLICATE_TARGET", message: "Duplicate target" });
    seen.add(addr);
  }
  if (errors.length > 0) return { valid: false, errors, expectedValues };

  const expectations = resolveTargetExpectations(exercise, options);
  const keys: Record<string, string> = {};
  for (const t of targets) {
    const addr = canonicalAddress(t.cell);
    const resolved = expectations[addr];
    if ("formula" in t.expected) {
      keys[addr] = t.expected.formula;
      if (resolved?.error) {
        errors.push({
          cell: addr,
          code: "INVALID_EXPECTED_FORMULA",
          message: `Answer-key formula failed: ${resolved.error}`,
        });
      }
      expectedValues[addr] = resolved?.value ?? null;
    } else {
      // Literal answer: validate it through the single-cell validator.
      const v = validateExercise(
        { ...exercise.rules, ...t, sheet: exercise.sheet, targetCell: addr, expected: t.expected },
        options,
      );
      expectedValues[addr] = v.expectedValue;
      for (const e of v.errors) errors.push({ cell: addr, code: e.code, message: e.message });
    }
  }
  if (errors.length > 0) return { valid: false, errors, expectedValues };

  const sanity = gradeMultiCellSubmission(exercise, keys, options);
  for (const [addr, r] of Object.entries(sanity.cells)) {
    if (!(addr in keys)) continue;
    if (r.unsupportedFunctions.length > 0) {
      errors.push({
        cell: addr,
        code: "UNSUPPORTED_FUNCTION",
        message: `Answer key uses unsupported functions: ${r.unsupportedFunctions.join(", ")}`,
      });
    } else if (!r.correct) {
      errors.push({
        cell: addr,
        code: "ANSWER_KEY_NOT_ACCEPTED",
        message: `Answer-key formula is rejected by the exercise rules (${r.feedbackCode})`,
      });
    }
  }
  return { valid: errors.length === 0, errors, expectedValues };
}

/** Removes answer keys: what the student grid needs. */
export function toStudentSheet(exercise: MultiCellExercise): {
  sheet: SheetData;
  targetCells: string[];
} {
  const targetCells = exercise.targets.map((t) => canonicalAddress(t.cell));
  const sheet = toA1Map(exercise.sheet);
  for (const addr of targetCells) delete sheet[addr];
  return { sheet, targetCells };
}
