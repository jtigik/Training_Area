// @vitest-environment node
/**
 * Suíte do dataset de fórmulas do QA contra o motor de correção.
 * Fonte canônica: /workspace/training_area/qa/excel_formulas/
 * (cópia em ./__fixtures__/qa-dataset).
 *
 * Os casos com oráculo já decidido pelo PO e motor divergente ficam em
 * `it.fails` (ENG-001 a ENG-003). Quando o motor for corrigido, esses testes
 * passam a falhar por "passed but expected to fail" — aí remova o `.fails`.
 *
 * F-125 (Q-F9) e F-148 (Q-F5) documentam o comportamento atual e não falham
 * a suíte: ainda são perguntas de produto, não defeitos.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { gradeSubmission, validateExercise, type ExerciseDefinition } from "./index";

const DATASET_DIR =
  process.env.DATASET_DIR ?? path.join(__dirname, "__fixtures__/qa-dataset");

const OPEN_PRODUCT_DIVERGENCES: Record<string, string> = {
  "F-125": "Q-F9",
  "F-148": "Q-F5",
};

const KNOWN_DEFECTS: Record<string, string> = {
  "F-033": "ENG-001",
  "F-044": "ENG-001",
  "F-049": "ENG-002",
  "F-068": "ENG-003",
};

type FormulaCase = {
  id: string;
  exercise: string;
  candidate: string;
  expected_verdict: "correct" | "incorrect";
  expected_feedback_code?: string;
  category: string;
  subcategory?: string;
  exercise_overrides?: Partial<ExerciseDefinition>;
};

type Context = { id: string; definition: ExerciseDefinition };

const formulas = JSON.parse(
  fs.readFileSync(path.join(DATASET_DIR, "formulas.json"), "utf8"),
) as FormulaCase[];
const contexts = JSON.parse(
  fs.readFileSync(path.join(DATASET_DIR, "contexts.json"), "utf8"),
) as Context[];
const ctx = Object.fromEntries(contexts.map((c) => [c.id, c]));

function grade(c: FormulaCase) {
  const exercise = {
    ...ctx[c.exercise].definition,
    ...(c.exercise_overrides ?? {}),
  };
  return gradeSubmission(exercise, c.candidate);
}

function verdictOf(r: { correct: boolean }) {
  return r.correct ? "correct" : "incorrect";
}

function matchesOracle(c: FormulaCase) {
  const r = grade(c);
  const codeOk =
    !c.expected_feedback_code || c.expected_feedback_code === r.feedbackCode;
  return verdictOf(r) === c.expected_verdict && codeOk;
}

const expectedInvalidContexts = new Set(["EX-RAND", "EX-ERRGAB"]);
const matching = formulas.filter(
  (c) => !KNOWN_DEFECTS[c.id] && !OPEN_PRODUCT_DIVERGENCES[c.id],
);
const defects = formulas.filter((c) => KNOWN_DEFECTS[c.id]);
const openQuestions = formulas.filter((c) => OPEN_PRODUCT_DIVERGENCES[c.id]);

describe("dataset QA — contextos", () => {
  it.each(contexts.map((c) => [c.id, c]))(
    "%s é validado de acordo com o oráculo",
    (_id, c) => {
      const v = validateExercise((c as Context).definition);
      if (expectedInvalidContexts.has((c as Context).id)) {
        expect(v.valid).toBe(false);
      } else {
        expect(v.valid, v.errors.map((e) => e.code).join("|")).toBe(true);
      }
    },
  );
});

describe("dataset QA — casos alinhados ao oráculo", () => {
  it.each(matching.map((c) => [c.id, c.category, c] as const))(
    "%s [%s] coincide com o oráculo",
    (_id, _category, c) => {
      const r = grade(c);
      expect(verdictOf(r)).toBe(c.expected_verdict);
      if (c.expected_feedback_code) {
        expect(r.feedbackCode).toBe(c.expected_feedback_code);
      }
    },
  );
});

describe("dataset QA — defeitos conhecidos (oráculo do PO; o motor ainda falha)", () => {
  it.fails.each(defects.map((c) => [c.id, KNOWN_DEFECTS[c.id], c] as const))(
    "%s (%s) deveria seguir o oráculo",
    (_id, _bug, c) => {
      expect(matchesOracle(c)).toBe(true);
    },
  );
});

describe("dataset QA — perguntas de produto pendentes (não são defeito)", () => {
  it("F-125 (Q-F9) avalia =SUM(A1:A3*1) como FORMULA_ERROR / #VALUE! com useArrayArithmetic=false", () => {
    const c = openQuestions.find((x) => x.id === "F-125");
    expect(c).toBeDefined();
    const r = grade(c!);
    expect(r.correct).toBe(false);
    expect(r.feedbackCode).toBe("FORMULA_ERROR");
    expect(r.actualValue).toBe("#VALUE!");
    // Oráculo do QA ainda espera CORRECT até o PO decidir Q-F9.
    expect(c!.expected_verdict).toBe("correct");
  });

  it("F-148 (Q-F5) avalia =RAND() como WRONG_VALUE (dois sorteios não comparáveis por valor)", () => {
    const c = openQuestions.find((x) => x.id === "F-148");
    expect(c).toBeDefined();
    const r = grade(c!);
    expect(r.correct).toBe(false);
    expect(r.feedbackCode).toBe("WRONG_VALUE");
    expect(c!.expected_verdict).toBe("correct");
  });
});
