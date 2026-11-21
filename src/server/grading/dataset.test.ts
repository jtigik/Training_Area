// @vitest-environment node
/**
 * Suíte do dataset de fórmulas do QA contra o motor de correção.
 * Fonte canônica: /workspace/training_area/qa/excel_formulas/
 * (cópia em ./__fixtures__/qa-dataset).
 *
 * ENG-001 a ENG-003 (F-033, F-044, F-049, F-068) foram corrigidos e voltaram a ser `it` normal.
 *
 * Divergências POR DESIGN (decisões do PO de 21/11/2026, posteriores ao oráculo):
 * - teste de sensibilidade: coincidências de valor (F-050, F-118, F-120, F-122) → INPUT_INSENSITIVE;
 * - funções voláteis proibidas por padrão: o oráculo já foi atualizado (F-145..F-148, F-154..F-157
 *   → VOLATILE_FUNCTION) e os gabaritos EX-TODAY/EX-RAND são inválidos;
 * - useArrayArithmetic ligado: F-125 (=SUM(A1:A3*1)) agora é CORRECT, como o oráculo espera.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { gradeSubmission, validateExercise, type ExerciseDefinition } from "./index";

const DATASET_DIR = process.env.DATASET_DIR ?? path.join(__dirname, "__fixtures__/qa-dataset");

/** Cases whose engine result differs from the oracle on purpose: id → [decision, feedbackCode]. */
const BY_DESIGN: Record<string, [string, string]> = {
  "F-050": ["sensibilidade", "INPUT_INSENSITIVE"],
  "F-118": ["sensibilidade", "INPUT_INSENSITIVE"],
  "F-120": ["sensibilidade", "INPUT_INSENSITIVE"],
  "F-122": ["sensibilidade", "INPUT_INSENSITIVE"],
};

/** Former defects, fixed on feat/motor-exercicios. */
const FIXED_DEFECTS: Record<string, string> = {
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

const expectedInvalidContexts = new Set(["EX-RAND", "EX-ERRGAB", "EX-TODAY"]);
const matching = formulas.filter((c) => !BY_DESIGN[c.id] && !FIXED_DEFECTS[c.id]);
const fixed = formulas.filter((c) => FIXED_DEFECTS[c.id]);
const byDesign = formulas.filter((c) => BY_DESIGN[c.id]);

describe("dataset QA — contextos", () => {
  it.each(contexts.map((c) => [c.id, c]))("%s é validado de acordo com o oráculo", (_id, c) => {
    const v = validateExercise((c as Context).definition);
    if (expectedInvalidContexts.has((c as Context).id)) {
      expect(v.valid).toBe(false);
    } else {
      expect(v.valid, v.errors.map((e) => e.code).join("|")).toBe(true);
    }
  });
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

describe("dataset QA — defeitos corrigidos (ENG-001 a ENG-003)", () => {
  it.each(fixed.map((c) => [c.id, FIXED_DEFECTS[c.id], c] as const))(
    "%s (%s) segue o oráculo",
    (_id, _bug, c) => {
      const r = grade(c);
      expect(verdictOf(r)).toBe(c.expected_verdict);
      if (c.expected_feedback_code) expect(r.feedbackCode).toBe(c.expected_feedback_code);
    },
  );
});

describe("dataset QA — divergências por design (decisões do PO)", () => {
  it.each(byDesign.map((c) => [c.id, BY_DESIGN[c.id]![0], c] as const))(
    "%s (%s) é incorreto com o código da decisão",
    (id, _why, c) => {
      const r = grade(c);
      expect(r.correct).toBe(false);
      expect(r.feedbackCode).toBe(BY_DESIGN[id]![1]);
    },
  );

  it("F-125 (Q-F9 decidida: useArrayArithmetic) é CORRECT", () => {
    const c = formulas.find((x) => x.id === "F-125")!;
    expect(grade(c).feedbackCode).toBe("CORRECT");
  });
});
