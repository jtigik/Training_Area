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
  initialSheet: { cells: { B1: { value: 1 } } },
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
