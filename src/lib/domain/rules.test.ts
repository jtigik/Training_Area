import { describe, expect, it } from "vitest";
import {
  buildStudentRows,
  filterAttempts,
  getPublishIssues,
  isLastActiveAdmin,
  pickBand,
  renderTemplate,
  validateBands,
} from "./rules";
import { createSeed } from "../services/mock/seed";

describe("publicação de conjunto", () => {
  it("permite publicar quando o pool atende às quantidades", () => {
    const db = createSeed();
    expect(getPublishIssues(db.sets[0], db.exercises)).toEqual([]);
  });

  it("bloqueia quando a quantidade excede o pool publicado", () => {
    const db = createSeed();
    const set = {
      ...db.sets[0],
      quantities: [
        { level: "fundamental" as const, difficulty: null, quantity: 5 },
        { level: "profissional" as const, difficulty: null, quantity: 1 },
      ],
    };
    const issues = getPublishIssues(set, db.exercises);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "fundamental", required: 5, available: 2 });
  });

  it("exige quantidade para cada nível e ignora exercícios não publicados", () => {
    const db = createSeed();
    db.exercises[2].published = false;
    const set = {
      ...db.sets[0],
      quantities: [{ level: "fundamental" as const, difficulty: null, quantity: 1 }],
    };
    const issues = getPublishIssues(set, db.exercises);
    expect(issues.map((i) => i.level)).toEqual(["profissional"]);
  });
});

describe("faixas de feedback", () => {
  it("aceita cobertura completa", () => {
    expect(
      validateBands([
        { minPercent: 0, maxPercent: 50 },
        { minPercent: 51, maxPercent: 100 },
      ]),
    ).toEqual([]);
  });
  it("detecta lacunas, sobreposição e limites", () => {
    expect(
      validateBands([
        { minPercent: 0, maxPercent: 40 },
        { minPercent: 60, maxPercent: 100 },
      ])[0],
    ).toMatch(/Lacuna/);
    expect(
      validateBands([
        { minPercent: 0, maxPercent: 60 },
        { minPercent: 50, maxPercent: 100 },
      ])[0],
    ).toMatch(/sobrepõem/);
    expect(validateBands([{ minPercent: 10, maxPercent: 90 }])).toHaveLength(2);
  });
  it("renderiza template e escolhe faixa", () => {
    expect(
      renderTemplate("{{nome}}: {{acertos}}/{{total}} ({{percentual}}) {{x}}", {
        nome: "Bia",
        nivel: "Fundamental",
        acertos: 3,
        total: 4,
      }),
    ).toBe("Bia: 3/4 (75%) {{x}}");
    expect(
      pickBand(
        [
          { minPercent: 0, maxPercent: 50 },
          { minPercent: 51, maxPercent: 100 },
        ],
        75,
      )?.minPercent,
    ).toBe(51);
  });
});

describe("usuários", () => {
  it("identifica o último admin ativo", () => {
    const db = createSeed();
    expect(isLastActiveAdmin(db.users, "u-admin")).toBe(true);
    expect(isLastActiveAdmin(db.users, "u-prof")).toBe(false);
  });
});

describe("resultados", () => {
  it("filtra por período em America/Sao_Paulo", () => {
    const db = createSeed();
    // a-6 = 2026-11-19T18:30Z = 15:30 em SP
    expect(
      filterAttempts(db.attempts, { from: "2026-11-19", to: "2026-11-19" }).map((a) => a.id),
    ).toEqual(["a-6"]);
    expect(filterAttempts(db.attempts, { from: "2026-12-01" })).toEqual([]);
  });

  it("mantém alunos sem tentativas como não iniciados", () => {
    const db = createSeed();
    const students = db.users.filter((u) => u.role === "STUDENT");
    const rows = buildStudentRows(students, db.attempts, db.progress, [
      "fundamental",
      "profissional",
    ]);
    const fernanda = rows.find((r) => r.student.id === "u-al5")!;
    expect(fernanda.attempts).toBe(0);
    expect(fernanda.levels.fundamental).toBe("nao_iniciado");
    const bia = rows.find((r) => r.student.id === "u-al1")!;
    expect(bia).toMatchObject({ attempts: 4, correct: 2, accuracy: 50 });
    expect(bia.levels).toEqual({ fundamental: "concluido", profissional: "em_andamento" });
  });

  it("aplica filtro de nível nos totais", () => {
    const db = createSeed();
    const students = db.users.filter((u) => u.role === "STUDENT");
    const rows = buildStudentRows(students, db.attempts, db.progress, ["fundamental"], {
      level: "profissional",
    });
    expect(rows.find((r) => r.student.id === "u-al1")!.attempts).toBe(1);
  });
});
