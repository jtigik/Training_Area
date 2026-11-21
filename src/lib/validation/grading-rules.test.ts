import { describe, expect, it } from "vitest";

import { gradingRulesSchema } from "./grading-rules";

describe("gradingRulesSchema ({ rules?, targets? })", () => {
  it("aceita regras do exercício e por célula (célula normalizada)", () => {
    expect(
      gradingRulesSchema.parse({
        rules: { requiredFunctions: ["PROCV"], numberTolerance: 0.01 },
        targets: { e1: { caseInsensitive: true } },
      }),
    ).toEqual({
      rules: { requiredFunctions: ["PROCV"], numberTolerance: 0.01 },
      targets: { E1: { caseInsensitive: true } },
    });
    expect(gradingRulesSchema.parse({})).toEqual({});
  });

  it("recusa chaves desconhecidas, função exigida e proibida, tolerância negativa e célula inválida", () => {
    for (const body of [
      { version: 1 },
      { rules: { futureOption: true } },
      { rules: { requiredFunctions: ["SE"], forbiddenFunctions: ["se"] } },
      { rules: { numberTolerance: -1 } },
      { targets: { "1A": {} } },
    ]) {
      expect(gradingRulesSchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });
});
