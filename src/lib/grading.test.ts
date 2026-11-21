import { describe, expect, it } from "vitest";

import { canRetryLevel, decideStartLevel } from "./grading";

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
