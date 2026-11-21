// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  canRetryLevel,
  computeConcept,
  DEFAULT_CONCEPT_RULES,
  resolveConceptRules,
} from "./concept";

const input = (correct: number, first = correct, required = 10) => ({
  requiredCount: required,
  exercisesCorrect: correct,
  firstAttemptCorrect: first,
});

describe("computeConcept", () => {
  it.each([
    [0, "ND"],
    [4, "ND"],
    [5, "ED"],
    [6, "ED"],
    [7, "D"],
    [8, "D"],
    [9, "PD"],
    [10, "PD"],
  ])("%i/10 com regras padrão → %s", (correct, concept) => {
    expect(computeConcept(input(correct)).concept).toBe(concept);
  });

  it("usa a base configurada (primeira tentativa) e limiares do professor", () => {
    const rules = resolveConceptRules({
      basis: "firstAttempt",
      thresholds: { ED: 40, D: 60, PD: 80 },
    });
    expect(computeConcept(input(10, 6), rules)).toEqual({
      concept: "D",
      percent: 60,
      basis: "firstAttempt",
    });
    expect(computeConcept(input(10, 3), rules).concept).toBe("ND");
  });

  it("limita a 100% e protege divisão por zero", () => {
    expect(computeConcept(input(12, 12, 10)).percent).toBe(100);
    expect(computeConcept(input(0, 0, 0)).concept).toBe("ND");
  });

  it("valida regras incoerentes", () => {
    expect(() => resolveConceptRules({ thresholds: { ED: 80, D: 70, PD: 90 } })).toThrow();
    expect(resolveConceptRules(null)).toEqual(DEFAULT_CONCEPT_RULES);
  });
});

describe("canRetryLevel", () => {
  it("permite refazer só com ND ou ED", () => {
    expect(canRetryLevel("ND", 1).allowed).toBe(true);
    expect(canRetryLevel("ED", 3).allowed).toBe(true);
    expect(canRetryLevel("D", 1)).toMatchObject({
      allowed: false,
      reason: "CONCEPT_NOT_RETRYABLE",
    });
    expect(canRetryLevel("PD", 1).allowed).toBe(false);
  });

  it("respeita o limite de refações", () => {
    const rules = resolveConceptRules({ maxRetries: 2 });
    expect(canRetryLevel("ND", 1, rules)).toMatchObject({ allowed: true, retriesLeft: 2 });
    expect(canRetryLevel("ND", 2, rules)).toMatchObject({ allowed: true, retriesLeft: 1 });
    expect(canRetryLevel("ND", 3, rules)).toMatchObject({
      allowed: false,
      reason: "MAX_RETRIES_REACHED",
    });
  });
});
