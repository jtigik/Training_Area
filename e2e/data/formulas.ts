/**
 * Dataset de fórmulas dos e2e, derivado do dataset oficial do QA
 * (e2e/data/qa/formulas.json + contexts.json, sincronizados de qa/excel_formulas).
 */
import qaContexts from "./qa/contexts.json";
import qaFormulas from "./qa/formulas.json";
import selection from "./formulas.json";

/** Classe de resultado esperada na UI. */
export type Expected = "correct" | "incorrect" | "invalid" | "unsupported" | "fixed_value";

export interface FormulaCase {
  id: string;
  input: string;
  /** Código de feedback esperado do motor (CORRECT, WRONG_VALUE, FORMULA_REQUIRED, …). */
  code: string;
  expected: Expected;
  note: string;
}

interface QaCase {
  id: string;
  exercise: string;
  candidate: string;
  expected_verdict: "correct" | "incorrect";
  expected_feedback_code: string;
  subcategory: string;
  exercise_overrides?: unknown;
}

const context = (
  qaContexts as unknown as {
    id: string;
    definition: {
      sheet: Record<string, number | string>;
      targetCell: string;
      expected: { formula?: string };
    };
    expected_value: number | string;
  }[]
).find((c) => c.id === selection.exercise.context)!;

export const EXERCISE = {
  ...selection.exercise,
  grid: context.definition.sheet,
  answerCell: context.definition.targetCell,
  answerFormula: context.definition.expected.formula ?? "",
  answerValue: context.expected_value,
};

/** Feedback exigido quando o aluno digita um valor fixo em vez de fórmula (PO, 21/11). */
export const FIXED_VALUE_FEEDBACK = selection.fixedValueFeedback;

function classify(c: QaCase): Expected {
  if (selection.fixedValueCases.includes(c.id)) return "fixed_value";
  if (c.expected_verdict === "correct") return "correct";
  if (c.expected_feedback_code === "PARSE_ERROR") return "invalid";
  if (c.expected_feedback_code === "UNSUPPORTED_FUNCTION") return "unsupported";
  return "incorrect";
}

const byId = new Map((qaFormulas as QaCase[]).map((c) => [c.id, c]));

export const FORMULA_CASES: FormulaCase[] = selection.e2eCases.map((id) => {
  const c = byId.get(id);
  if (!c) throw new Error(`[e2e] caso ${id} não existe em e2e/data/qa/formulas.json — sincronize`);
  if (c.exercise !== selection.exercise.context || c.exercise_overrides) {
    throw new Error(
      `[e2e] caso ${id} não é do exercício ${selection.exercise.context} sem overrides`,
    );
  }
  return {
    id,
    input: c.candidate,
    code: c.expected_feedback_code,
    expected: classify(c),
    note: c.subcategory,
  };
});

export const casesBy = (expected: Expected) => FORMULA_CASES.filter((c) => c.expected === expected);

/** Versão curta da entrada para títulos de teste. */
export const show = (input: string) =>
  JSON.stringify(input.length > 32 ? `${input.slice(0, 29)}…` : input);
