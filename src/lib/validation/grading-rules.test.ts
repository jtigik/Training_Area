import { describe, expect, it } from "vitest";

import { gradingRulesSchema } from "./grading-rules";

describe("gradingRulesSchema", () => {
  it("normaliza funções e aplica versão", () => {
    expect(
      gradingRulesSchema.parse({
        requiredFunctions: ["procv"],
        tolerance: 0.01,
        caseSensitive: false,
      }),
    ).toEqual({ version: 1, requiredFunctions: ["PROCV"], tolerance: 0.01, caseSensitive: false });
  });

  it("preserva chaves desconhecidas (extensível)", () => {
    expect(gradingRulesSchema.parse({ futureOption: { a: 1 } })).toMatchObject({
      futureOption: { a: 1 },
    });
  });

  it("recusa função exigida e proibida, tolerância negativa e nome inválido", () => {
    expect(
      gradingRulesSchema.safeParse({ requiredFunctions: ["SE"], forbiddenFunctions: ["se"] })
        .success,
    ).toBe(false);
    expect(gradingRulesSchema.safeParse({ tolerance: -1 }).success).toBe(false);
    expect(gradingRulesSchema.safeParse({ requiredFunctions: ["=SOMA("] }).success).toBe(false);
  });
});
