import { describe, expect, it } from "vitest";
import {
  exerciseSetFormSchema,
  feedbackFormSchema,
  newInstitutionFormSchema,
  sectionFormSchema,
  userFormSchema,
  validateXlsxFile,
} from "./schemas";

const baseSet = {
  name: "Conjunto",
  description: "",
  levels: ["FUNDAMENTAL"],
  difficulties: ["EASY"],
  quantities: [{ level: "FUNDAMENTAL", difficulty: null, quantity: 2 }],
  overrides: [],
};

describe("schemas", () => {
  it("valida usuário da instituição (sem SUPER_ADMIN)", () => {
    expect(
      userFormSchema.safeParse({ name: "Ana", email: "ana@x.com", role: "TEACHER" }).success,
    ).toBe(true);
    expect(
      userFormSchema.safeParse({ name: "Ana", email: "ana@x.com", role: "SUPER_ADMIN" }).success,
    ).toBe(false);
    const r = userFormSchema.safeParse({ name: " ", email: "x", role: "ROOT" });
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["email", "name", "role"]);
  });

  it("valida instituição nova e normaliza domínios", () => {
    const ok = newInstitutionFormSchema.safeParse({
      name: "Escola",
      slug: "escola-1",
      domains: "Escola.edu.br, outra.com",
      adminName: "Ana",
      adminEmail: "ana@escola.edu.br",
    });
    expect(ok.success && ok.data.domains).toEqual(["escola.edu.br", "outra.com"]);
    const bad = newInstitutionFormSchema.safeParse({
      name: "",
      slug: "Escola X",
      domains: "nada",
      adminName: "",
      adminEmail: "x",
    });
    expect(bad.error?.issues.map((i) => i.path[0]).sort()).toEqual([
      "adminEmail",
      "adminName",
      "domains",
      "name",
      "slug",
    ]);
  });

  it("seção aceita só níveis do MVP", () => {
    expect(sectionFormSchema.safeParse({ title: "T", body: "b", level: null }).success).toBe(true);
    expect(sectionFormSchema.safeParse({ title: "T", body: "b", level: "DASHBOARD" }).success).toBe(
      false,
    );
  });

  it("conjunto exige nível, quantidade positiva por nível e recorte válido", () => {
    expect(exerciseSetFormSchema.safeParse(baseSet).success).toBe(true);
    expect(
      exerciseSetFormSchema.safeParse({ ...baseSet, levels: [], quantities: [] }).error?.issues[0]
        .message,
    ).toMatch(/nível/);
    const zero = exerciseSetFormSchema.safeParse({
      ...baseSet,
      quantities: [{ level: "FUNDAMENTAL", difficulty: null, quantity: 0 }],
    });
    expect(zero.error?.issues[0].message).toMatch(/quantidade deve ser maior que zero/i);
    const missing = exerciseSetFormSchema.safeParse({
      ...baseSet,
      levels: ["FUNDAMENTAL", "ADVANCED"],
    });
    expect(missing.error?.issues[0].message).toMatch(/quantidade de cada nível/);
    const dashboard = exerciseSetFormSchema.safeParse({ ...baseSet, levels: ["DASHBOARD"] });
    expect(dashboard.success).toBe(false);
  });

  it("recusa recorte fora do conjunto ou repetido", () => {
    const r = exerciseSetFormSchema.safeParse({
      ...baseSet,
      quantities: [
        { level: "FUNDAMENTAL", difficulty: null, quantity: 1 },
        { level: "FUNDAMENTAL", difficulty: "HARD", quantity: 1 },
        { level: "FUNDAMENTAL", difficulty: null, quantity: 1 },
      ],
    });
    expect(r.error?.issues.map((i) => i.message)).toEqual([
      "Dificuldade não selecionada no conjunto.",
      "Recorte repetido.",
    ]);
  });

  it("valida faixa de feedback", () => {
    expect(
      feedbackFormSchema.safeParse({
        bands: [{ minPercent: 0, maxPercent: 100, label: "", template: "t" }],
      }).success,
    ).toBe(true);
    expect(
      feedbackFormSchema.safeParse({
        bands: [{ minPercent: 80, maxPercent: 10, label: "a", template: "t" }],
      }).success,
    ).toBe(false);
  });

  it("valida arquivo .xlsx", () => {
    const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    expect(validateXlsxFile({ name: "a.xlsx", size: 100, type: mime })).toBeNull();
    expect(validateXlsxFile({ name: "a.xls", size: 100, type: "" })).toMatch(/\.xlsx/);
    expect(validateXlsxFile({ name: "a.xlsx", size: 3 * 1024 * 1024, type: mime })).toMatch(/2 MB/);
    expect(validateXlsxFile({ name: "a.xlsx", size: 0, type: mime })).toMatch(/vazio/);
    expect(validateXlsxFile({ name: "a.xlsx", size: 10, type: "text/csv" })).toMatch(/não parece/);
  });
});
