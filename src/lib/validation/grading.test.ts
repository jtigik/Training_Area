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
