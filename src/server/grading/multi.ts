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
      // The answer key stays the reference for the sensitivity check and hardcode heuristics.
      ...("formula" in t.expected ? { referenceFormula: t.expected.formula } : {}),
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
// API / storage cell format (agreed with Frontend 1/2 and Backend 1, 21/11/2026):
//   cell value = number | string | boolean | null | { f: "=SOMA(A1:A3)", v? }
// Formulas exist ONLY inside `{ f }`: a plain string starting with "=" is literal text, and
// 10 (number) ≠ "10" (text). Backend 1 JSON columns:
//   Exercise.initialSheet   = { cells: { "A1": ApiCellValue } }
//   Exercise.expectedResult = [{ cell: "B4", value?: scalar | {date}, formula?: "=...", tolerance? }]
//   Exercise.gradingRules   = { rules?: GradingRules, targets?: { "B4": GradingRules } }
// Engine convention (internal): strings starting with "=" are formulas, a leading apostrophe
// marks text.
// ---------------------------------------------------------------------------

export type ApiScalar = number | string | boolean | null;
export type ApiCellValue = ApiScalar | { f: string; v?: ApiScalar };

export interface SchemaInitialSheet {
  cells: Record<string, ApiCellValue>;
}

export interface SchemaExpectedCell {
  cell: string;
  value?: string | number | boolean | { date: string };
  formula?: string;
  tolerance?: number;
}

export interface SchemaGradingRules {
  rules?: GradingRules;
  targets?: Record<string, GradingRules>;
}

export function isFormulaCell(v: unknown): v is { f: string; v?: ApiScalar } {
  return typeof v === "object" && v !== null && typeof (v as { f?: unknown }).f === "string";
}

/** API cell → engine cell. */
export function apiCellToEngine(v: ApiCellValue | undefined): CellInput {
  if (v === undefined || v === null) return null;
  if (isFormulaCell(v)) {
    const f = v.f.trim();
    return f.startsWith("=") ? f : `=${f}`;
  }
  if (typeof v === "string") return v.startsWith("=") || v.startsWith("'") ? `'${v}` : v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  return null;
}

/** Engine cell → API cell. */
export function engineCellToApi(v: CellInput): ApiCellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    if (v.trim().startsWith("=")) return { f: v.trim() };
    if (v.startsWith("'")) return v.slice(1);
    return v;
  }
  return v as ApiScalar;
}

/** Legacy draft shape `{ value?, formula?, locked? }` is still accepted on read. */
function legacyCell(v: unknown): ApiCellValue | undefined {
  if (typeof v !== "object" || v === null || isFormulaCell(v)) return v as ApiCellValue;
  const o = v as { value?: ApiScalar; formula?: string };
  if (typeof o.formula === "string") return { f: o.formula };
  return o.value ?? null;
}

export function fromSchemaExercise(
  initialSheet: SchemaInitialSheet,
  expectedResult: SchemaExpectedCell[],
  gradingRules?: SchemaGradingRules | GradingRules | null,
): MultiCellExercise {
  const sheet: Record<string, CellInput> = {};
  for (const [addr, cell] of Object.entries(initialSheet?.cells ?? {})) {
    if (!parseA1(addr)) continue;
    const engine = apiCellToEngine(legacyCell(cell));
    if (engine !== null) sheet[canonicalAddress(addr)] = engine;
  }
  const wrapped =
    gradingRules && ("rules" in gradingRules || "targets" in gradingRules)
      ? (gradingRules as SchemaGradingRules)
      : { rules: (gradingRules as GradingRules | null | undefined) ?? undefined };
  const targets: ExerciseTarget[] = (expectedResult ?? []).map((e) => {
    const cell = canonicalAddress(e.cell);
    return {
      ...(wrapped.targets?.[cell] ?? {}),
      cell,
      expected: e.formula !== undefined ? { formula: e.formula } : { value: e.value ?? "" },
      ...(e.tolerance !== undefined ? { numberTolerance: e.tolerance } : {}),
    };
  });
  return { sheet, targets, ...(wrapped.rules ? { rules: wrapped.rules } : {}) };
}

/**
 * Inverse of `fromSchemaExercise`: engine content → Backend 1's JSON columns. Target cells are
 * omitted from the initial sheet; per-target rules go to `gradingRules.targets`.
 */
export function toSchemaExercise(exercise: MultiCellExercise): {
  initialSheet: SchemaInitialSheet;
  expectedResult: SchemaExpectedCell[];
  gradingRules: SchemaGradingRules | null;
} {
  const targets = new Set(exercise.targets.map((t) => canonicalAddress(t.cell)));
  const cells: SchemaInitialSheet["cells"] = {};
  for (const [addr, v] of Object.entries(toA1Map(exercise.sheet))) {
    if (targets.has(addr) || v === null || v === undefined || v === "") continue;
    cells[addr] = engineCellToApi(v);
  }
  const perTarget: Record<string, GradingRules> = {};
  const expectedResult = exercise.targets.map((t): SchemaExpectedCell => {
    const cell = canonicalAddress(t.cell);
    const { cell: _c, expected, numberTolerance, ...rest } = t;
    void _c;
    if (Object.keys(rest).length > 0) perTarget[cell] = rest;
    const tol = numberTolerance ?? exercise.rules?.numberTolerance;
    return {
      cell,
      ...("formula" in expected
        ? { formula: expected.formula }
        : { value: expected.value as SchemaExpectedCell["value"] }),
      ...(tol !== undefined ? { tolerance: tol } : {}),
    };
  });
  const gradingRules: SchemaGradingRules = {
    ...(exercise.rules && Object.keys(exercise.rules).length > 0 ? { rules: exercise.rules } : {}),
    ...(Object.keys(perTarget).length > 0 ? { targets: perTarget } : {}),
  };
  return {
    initialSheet: { cells },
    expectedResult,
    gradingRules: Object.keys(gradingRules).length > 0 ? gradingRules : null,
  };
}

/** Student-facing sheet in the API format (answer cells removed). */
export function toApiStudentSheet(exercise: MultiCellExercise): {
  cells: Record<string, ApiCellValue>;
  targetCells: string[];
} {
  const { sheet, targetCells } = toStudentSheet(exercise);
  const cells: Record<string, ApiCellValue> = {};
  for (const [addr, v] of Object.entries(sheet as Record<string, CellInput>)) {
    if (v !== null && v !== undefined && v !== "") cells[addr] = engineCellToApi(v);
  }
  return { cells, targetCells };
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
