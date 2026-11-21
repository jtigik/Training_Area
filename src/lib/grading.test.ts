import { describe, expect, it } from "vitest";

import {
  accuracyPercent,
  areValidGradingBands,
  canRetryLevel,
  computeConcept,
  decideStartLevel,
  DEFAULT_GRADING_BANDS,
} from "./grading";

describe("decideStartLevel", () => {
  it("primeira tentativa é sempre permitida", () => {
    expect(decideStartLevel([])).toEqual({ allowed: true, attemptNumber: 1 });
  });

  it("não abre outra com uma em andamento", () => {
    expect(decideStartLevel([{ attemptNumber: 1, status: "IN_PROGRESS", concept: null }])).toEqual({
      allowed: false,
      reason: "IN_PROGRESS",
    });
  });

  it.each(["ND", "ED"] as const)("refaz após %s", (concept) => {
    expect(decideStartLevel([{ attemptNumber: 1, status: "COMPLETED", concept }])).toEqual({
      allowed: true,
      attemptNumber: 2,
    });
  });

  it.each(["D", "PD"] as const)("não refaz após %s", (concept) => {
    expect(decideStartLevel([{ attemptNumber: 1, status: "COMPLETED", concept }])).toEqual({
      allowed: false,
      reason: "ALREADY_PASSED",
    });
  });

  it("considera a última concluída e numera após abandonadas", () => {
    expect(
      decideStartLevel([
        { attemptNumber: 1, status: "COMPLETED", concept: "ND" },
        { attemptNumber: 2, status: "ABANDONED", concept: null },
      ]),
    ).toEqual({ allowed: true, attemptNumber: 3 });
  });

  it("canRetryLevel", () => {
    expect(canRetryLevel("ED")).toBe(true);
    expect(canRetryLevel("PD")).toBe(false);
    expect(canRetryLevel(null)).toBe(false);
  });
});

describe("computeConcept (faixas padrão 50/70/90)", () => {
  it.each([
    [0, 10, "ND"],
    [49, 100, "ND"],
    [50, 100, "ED"],
    [69, 100, "ED"],
    [699, 1000, "ED"],
    [70, 100, "D"],
    [89, 100, "D"],
    [90, 100, "PD"],
    [10, 10, "PD"],
  ] as const)("%i/%i → %s", (correct, total, concept) => {
    expect(computeConcept(correct, total)).toBe(concept);
  });

  it("sem exercícios feitos → ND; acertos acima do total são limitados", () => {
    expect(computeConcept(0, 0)).toBe("ND");
    expect(accuracyPercent(12, 10)).toBe(100);
  });

  it("respeita faixas da instituição", () => {
    const bands = { edMinPercent: 40, dMinPercent: 60, pdMinPercent: 80 };
    expect(computeConcept(45, 100, bands)).toBe("ED");
    expect(computeConcept(65, 100, bands)).toBe("D");
    expect(computeConcept(80, 100, bands)).toBe("PD");
  });

  it("valida faixas", () => {
    expect(areValidGradingBands(DEFAULT_GRADING_BANDS)).toBe(true);
    expect(areValidGradingBands({ edMinPercent: 70, dMinPercent: 50, pdMinPercent: 90 })).toBe(
      false,
    );
    expect(areValidGradingBands({ edMinPercent: 0, dMinPercent: 50, pdMinPercent: 90 })).toBe(
      false,
    );
    expect(areValidGradingBands({ edMinPercent: 50, dMinPercent: 70, pdMinPercent: 101 })).toBe(
      false,
    );
  });
});
