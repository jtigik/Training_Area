import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_LEVELS,
  LEVEL_NOT_AVAILABLE_IN_MVP,
  MVP_LEVELS,
  SELECTABLE_LEVEL_OPTIONS,
} from "@/lib/domain";

import {
  exerciseInputSchema,
  exerciseSetInputSchema,
  exerciseUpdateSchema,
  levelInputSchema,
} from "./content";

const exercise = {
  title: "Somar vendas",
  statement: "Some B1:B3 em B4",
  initialSheet: { cells: { B1: 1, b2: { f: "=B1*2", v: 2 }, B3: "=texto literal", B4: null } },
  expectedResult: [{ cell: "b4", formula: "=SOMA(B1:B3)" }],
  level: "FUNDAMENTAL",
  difficulty: "EASY",
};

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe("níveis do MVP", () => {
  it("DASHBOARD está no enum, mas fora do MVP e da UI", () => {
    expect(KNOWLEDGE_LEVELS).toContain("DASHBOARD");
    expect(MVP_LEVELS).not.toContain("DASHBOARD");
    expect(SELECTABLE_LEVEL_OPTIONS.map((o) => o.value)).toEqual([
      "FUNDAMENTAL",
      "PROFESSIONAL",
      "ADVANCED",
    ]);
    expect(SELECTABLE_LEVEL_OPTIONS[1]?.label).toBe("Profissional");
  });
});

describe("exerciseInputSchema", () => {
  it("aceita exercício válido e normaliza a célula", () => {
    const parsed = exerciseInputSchema.parse(exercise);
    expect(parsed.expectedResult[0]?.cell).toBe("B4");
  });

  it("rejeita DASHBOARD com mensagem clara (criação e atualização)", () => {
    expect(messages(exerciseInputSchema.safeParse({ ...exercise, level: "DASHBOARD" }))).toContain(
      LEVEL_NOT_AVAILABLE_IN_MVP,
    );
    expect(messages(exerciseUpdateSchema.safeParse({ level: "DASHBOARD" }))).toContain(
      LEVEL_NOT_AVAILABLE_IN_MVP,
    );
  });

  it("rejeita gabarito vazio ou sem valor/fórmula e nível desconhecido", () => {
    expect(exerciseInputSchema.safeParse({ ...exercise, expectedResult: [] }).success).toBe(false);
    expect(
      exerciseInputSchema.safeParse({ ...exercise, expectedResult: [{ cell: "B4" }] }).success,
    ).toBe(false);
    expect(exerciseInputSchema.safeParse({ ...exercise, level: "EXPERT" }).success).toBe(false);
  });
});

describe("exerciseSetInputSchema / levelInputSchema", () => {
  const set = { name: "Trilha", levels: ["FUNDAMENTAL"], difficulties: ["EASY"] };

  it("aceita conjunto válido e exige ao menos um nível", () => {
    expect(exerciseSetInputSchema.safeParse(set).success).toBe(true);
    expect(exerciseSetInputSchema.safeParse({ ...set, levels: [] }).success).toBe(false);
  });

  it("rejeita DASHBOARD no conjunto e no nível", () => {
    expect(
      messages(exerciseSetInputSchema.safeParse({ ...set, levels: ["FUNDAMENTAL", "DASHBOARD"] })),
    ).toContain(LEVEL_NOT_AVAILABLE_IN_MVP);
    expect(messages(levelInputSchema.safeParse({ knowledgeLevel: "DASHBOARD" }))).toContain(
      LEVEL_NOT_AVAILABLE_IN_MVP,
    );
    expect(levelInputSchema.safeParse({ knowledgeLevel: "ADVANCED" }).success).toBe(true);
  });
});

describe("formato de célula combinado (BE2/FE1/FE2)", () => {
  it("aceita número, texto, booleano, nulo e { f, v? }; normaliza A1", () => {
    const parsed = exerciseInputSchema.parse({
      ...exercise,
      initialSheet: { cells: { a1: 1, B1: "x", C1: true, D1: null, E1: { f: "=A1+1" } } },
      gradingRules: {
        rules: { requiredFunctions: ["SOMA"] },
        targets: { b4: { numberTolerance: 0.01 } },
      },
    });
    expect(Object.keys(parsed.initialSheet.cells)).toEqual(["A1", "B1", "C1", "D1", "E1"]);
    expect(parsed.gradingRules?.targets).toEqual({ B4: { numberTolerance: 0.01 } });
  });

  it("recusa formato antigo { value } / { formula }, gabarito com valor E fórmula e regras soltas", () => {
    for (const patch of [
      { initialSheet: { cells: { A1: { value: 1 } } } },
      { initialSheet: { cells: { A1: { f: "" } } } },
      { initialSheet: { A1: 1 } },
      { expectedResult: [{ cell: "B4", value: 3, formula: "=SOMA(B1:B3)" }] },
      { gradingRules: { requiredFunctions: ["SOMA"] } },
    ]) {
      expect(
        exerciseInputSchema.safeParse({ ...exercise, ...patch }).success,
        JSON.stringify(patch),
      ).toBe(false);
    }
  });
});
