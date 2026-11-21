import { describe, expect, it } from "vitest";

import { conceptOverrideSchema, gradingBandsSchema } from "./grading";

describe("gradingBandsSchema", () => {
  it("aceita faixas crescentes e recusa fora de ordem", () => {
    expect(
      gradingBandsSchema.safeParse({ edMinPercent: 50, dMinPercent: 70, pdMinPercent: 90 }).success,
    ).toBe(true);
    expect(
      gradingBandsSchema.safeParse({ edMinPercent: 50, dMinPercent: 50, pdMinPercent: 90 }).success,
    ).toBe(false);
    expect(
      gradingBandsSchema.safeParse({ edMinPercent: 50.5, dMinPercent: 70, pdMinPercent: 90 })
        .success,
    ).toBe(false);
  });
});

describe("conceptOverrideSchema", () => {
  it("exige justificativa com pelo menos 10 caracteres", () => {
    expect(conceptOverrideSchema.safeParse({ concept: "D", reason: "  curta  " }).success).toBe(
      false,
    );
    expect(conceptOverrideSchema.safeParse({ concept: "D" }).success).toBe(false);
    expect(
      conceptOverrideSchema.safeParse({ concept: "X", reason: "justificativa longa" }).success,
    ).toBe(false);
    expect(
      conceptOverrideSchema.parse({
        concept: "D",
        reason: "  Revisei a planilha e o erro era de digitação ",
      }).reason,
    ).toBe("Revisei a planilha e o erro era de digitação");
  });
});

describe("gradingBandsSchema (0 < ND < ED < D ≤ 100)", () => {
  const ok = (ed: number, d: number, pd: number) =>
    gradingBandsSchema.safeParse({ edMinPercent: ed, dMinPercent: d, pdMinPercent: pd }).success;
  it("aceita o padrão e os extremos válidos", () => {
    expect(ok(50, 70, 90)).toBe(true);
    expect(ok(1, 2, 100)).toBe(true);
  });
  it("recusa zero, iguais, decrescentes, acima de 100 e não inteiros", () => {
    expect(ok(0, 70, 90)).toBe(false);
    expect(ok(50, 50, 90)).toBe(false);
    expect(ok(70, 50, 90)).toBe(false);
    expect(ok(50, 70, 101)).toBe(false);
    expect(ok(50.5, 70, 90)).toBe(false);
    expect(gradingBandsSchema.safeParse({ edMinPercent: 50 }).success).toBe(false);
  });
});
