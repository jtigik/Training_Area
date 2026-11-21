/**
 * Formula grading engine (motor de correção) — public API.
 * Pure TypeScript + HyperFormula; no DB, framework or Node-only APIs, so it can be
 * used by Next.js route handlers / server actions and by the browser grid (TA-021/TA-022).
 */
export { gradeSubmission, evaluateFormula, validateExercise, toStudentResult } from "./grade";
export { normalizeFormula, tokenize } from "./tokenizer";
export type { NormalizedFormula, Token, TokenKind } from "./tokenizer";
export {
  canonicalFunctionName,
  isKnownFunction,
  ptBrFunctionName,
  HYPERFORMULA_FUNCTIONS,
} from "./functions";
export { dateToSerial, serialToIsoDate, compareValues, parseConstant } from "./values";
export { DEFAULT_LIMITS, DEFAULT_SHEET_NAME, HYPERFORMULA_LICENSE_KEY } from "./config";
export { parseA1 } from "./sheet";
export { FEEDBACK_MESSAGES_PT_BR } from "./messages";
export type * from "./types";
export { analyzeFormula } from "./analysis";
export type {
  AnchorKind,
  ComplexityLevel,
  FormulaAnalysis,
  FormulaReference,
  FunctionUsage,
  ReferenceKind,
} from "./analysis";
export {
  columnName,
  fromSchemaExercise,
  gradeMultiCellSubmission,
  resolveTargetExpectations,
} from "./multi";
export type {
  ExerciseTarget,
  GradingRules,
  MultiCellExercise,
  MultiCellGradingResult,
  SchemaExpectedCell,
  SchemaInitialSheet,
} from "./multi";
