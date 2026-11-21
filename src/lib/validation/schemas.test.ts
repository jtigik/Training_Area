import { describe, expect, it } from "vitest";
import {
  exerciseSetFormSchema,
  feedbackFormSchema,
  sectionFormSchema,
  userFormSchema,
} from "./schemas";

const baseSet = {
  name: "Conjunto",
  description: "",
  levels: ["fundamental"],
  difficulties: ["facil"],
  quantities: [{ level: "fundamental", difficulty: null, quantity: 2 }],
  overrides: [],
};

describe("schemas", () => {
  it("valida usuário", () => {
    expect(
      userFormSchema.safeParse({
        name: "Ana",
        email: "ana@x.com",
        role: "TEACHER",
        onboarding: "convite",
      }).success,
    ).toBe(true);
    const r = userFormSchema.safeParse({
      name: " ",
      email: "x",
      role: "ROOT",
      onboarding: "convite",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["email", "name", "role"]);
  });

  it("valida seção", () => {
    expect(sectionFormSchema.safeParse({ title: "T", body: "b", level: null }).success).toBe(true);
    expect(sectionFormSchema.safeParse({ title: "", body: "b", level: "x" }).success).toBe(false);
  });

  it("exige ao menos um nível e quantidade positiva (TA-014/TA-015)", () => {
    expect(exerciseSetFormSchema.safeParse(baseSet).success).toBe(true);
    expect(
      exerciseSetFormSchema.safeParse({ ...baseSet, levels: [], quantities: [] }).success,
    ).toBe(false);
    const zero = exerciseSetFormSchema.safeParse({
      ...baseSet,
      quantities: [{ level: "fundamental", difficulty: null, quantity: 0 }],
    });
    expect(zero.error?.issues[0].message).toMatch(/maior que zero/);
  });

  it("recusa recorte fora do conjunto ou repetido", () => {
    const r = exerciseSetFormSchema.safeParse({
      ...baseSet,
      quantities: [
        { level: "avancado", difficulty: null, quantity: 1 },
        { level: "fundamental", difficulty: "dificil", quantity: 1 },
        { level: "fundamental", difficulty: null, quantity: 1 },
        { level: "fundamental", difficulty: null, quantity: 1 },
      ],
    });
    expect(r.error?.issues.map((i) => i.message)).toEqual([
      "Nível não selecionado no conjunto.",
      "Dificuldade não selecionada no conjunto.",
      "Recorte repetido.",
    ]);
  });

  it("valida faixa de feedback", () => {
    expect(
      feedbackFormSchema.safeParse({
        bands: [{ minPercent: 0, maxPercent: 100, label: "a", template: "t" }],
      }).success,
    ).toBe(true);
    expect(
      feedbackFormSchema.safeParse({
        bands: [{ minPercent: 80, maxPercent: 10, label: "a", template: "t" }],
      }).success,
    ).toBe(false);
  });
});
