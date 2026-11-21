import { describe, expect, it } from "vitest";
import {
  buildStudentRows,
  canRedoLevel,
  conceptFor,
  filterAttempts,
  formatDateTimeBR,
  getPublishIssues,
  isLastActiveAdmin,
  pickBand,
  renderTemplate,
  slugify,
  validateBands,
} from "./rules";
import { createSeed } from "../services/mock/seed";

const studentsOf = (db: ReturnType<typeof createSeed>) =>
  db.users.filter((u) => u.role === "ALUNO" && u.institutionId === "inst-1");

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
        { level: "FUNDAMENTAL" as const, difficulty: null, quantity: 5 },
        { level: "PROFESSIONAL" as const, difficulty: null, quantity: 1 },
      ],
    };
    const issues = getPublishIssues(set, db.exercises);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "FUNDAMENTAL", required: 5, available: 2 });
  });

  it("exige quantidade para cada nível e ignora exercícios em rascunho", () => {
    const db = createSeed();
    db.exercises[2].status = "DRAFT";
    const set = {
      ...db.sets[0],
      quantities: [{ level: "FUNDAMENTAL" as const, difficulty: null, quantity: 1 }],
    };
    expect(getPublishIssues(set, db.exercises).map((i) => i.level)).toEqual(["PROFESSIONAL"]);
  });
});

describe("conceitos", () => {
  it("mapeia taxa de acerto em ND/ED/D/PD", () => {
    expect([0, 49, 50, 69, 70, 89, 90, 100].map(conceptFor)).toEqual([
      "ND",
      "ND",
      "ED",
      "ED",
      "D",
      "D",
      "PD",
      "PD",
    ]);
  });
  it("só permite refazer nível concluído com ND ou ED", () => {
    expect(canRedoLevel({ status: "COMPLETED", concept: "ND" })).toBe(true);
    expect(canRedoLevel({ status: "COMPLETED", concept: "ED" })).toBe(true);
    expect(canRedoLevel({ status: "COMPLETED", concept: "D" })).toBe(false);
    expect(canRedoLevel({ status: "IN_PROGRESS", concept: null })).toBe(false);
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
      renderTemplate("{{nome}}: {{acertos}}/{{total}} ({{percentual}}, {{conceito}}) {{x}}", {
        nome: "Bia",
        nivel: "Fundamental",
        acertos: 3,
        total: 4,
      }),
    ).toBe("Bia: 3/4 (75%, D) {{x}}");
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

describe("usuários e instituições", () => {
  it("identifica o último admin ativo da instituição", () => {
    const db = createSeed();
    expect(isLastActiveAdmin(db.users, "u-admin")).toBe(true);
    expect(isLastActiveAdmin(db.users, "u-prof")).toBe(false);
    db.users.push({ ...db.users[1], id: "u-admin2", email: "x@y.z" });
    expect(isLastActiveAdmin(db.users, "u-admin")).toBe(false);
  });
  it("gera slug", () => {
    expect(slugify("  Escola Técnica São João! ")).toBe("escola-tecnica-sao-joao");
  });
});

describe("resultados", () => {
  it("filtra por período em America/Sao_Paulo", () => {
    const db = createSeed();
    // a-7 = 2026-11-19T18:30Z = 15:30 em SP
    expect(
      filterAttempts(db.attempts, { from: "2026-11-19", to: "2026-11-19" }).map((a) => a.id),
    ).toEqual(["a-7"]);
    expect(filterAttempts(db.attempts, { from: "2026-12-01" })).toEqual([]);
  });

  it("mantém alunos sem tentativas como não iniciados e expõe conceito/refazer", () => {
    const db = createSeed();
    const rows = buildStudentRows(studentsOf(db), db.attempts, db.progress, [
      "FUNDAMENTAL",
      "PROFESSIONAL",
    ]);
    const fernanda = rows.find((r) => r.student.id === "u-al5")!;
    expect(fernanda.attempts).toBe(0);
    expect(fernanda.levels.FUNDAMENTAL?.status).toBe("NOT_STARTED");
    const bia = rows.find((r) => r.student.id === "u-al1")!;
    expect(bia).toMatchObject({ attempts: 4, correct: 2, accuracy: 50 });
    expect(bia.levels.FUNDAMENTAL).toMatchObject({
      status: "COMPLETED",
      concept: "D",
      canRedo: false,
    });
    expect(bia.levels.PROFESSIONAL?.status).toBe("IN_PROGRESS");
    const carlos = rows.find((r) => r.student.id === "u-al2")!;
    expect(carlos.levels.FUNDAMENTAL).toMatchObject({ concept: "ND", canRedo: true });
  });

  it("aplica filtro de nível nos totais", () => {
    const db = createSeed();
    const rows = buildStudentRows(studentsOf(db), db.attempts, db.progress, ["FUNDAMENTAL"], {
      level: "PROFESSIONAL",
    });
    expect(rows.find((r) => r.student.id === "u-al1")!.attempts).toBe(1);
  });

  it("formata data/hora em SP sem vírgula", () => {
    expect(formatDateTimeBR("2026-11-12T14:05:00.000Z")).toBe("12/11/2026 11:05");
  });
});
