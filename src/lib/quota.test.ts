import { describe, expect, it } from "vitest";

import {
  buildQuotaScopeKey,
  DEFAULT_QUOTA_PER_DIFFICULTY,
  quotaScopeColumns,
  resolveDifficultyQuotas,
  type QuotaRecord,
} from "./quota";

const q = (over: Partial<QuotaRecord>): QuotaRecord => ({
  difficulty: "EASY",
  classroomId: null,
  studentId: null,
  quantity: 1,
  ...over,
});

const qty = (r: ReturnType<typeof resolveDifficultyQuotas>) =>
  Object.fromEntries(r.perDifficulty.map((d) => [d.difficulty, d.quantity]));

describe("buildQuotaScopeKey", () => {
  it("bate com o CHECK da migração", () => {
    expect(buildQuotaScopeKey({ kind: "default" }, "EASY")).toBe("default|EASY");
    expect(buildQuotaScopeKey({ kind: "classroom", classroomId: "c1" }, "MEDIUM")).toBe(
      "classroom:c1|MEDIUM",
    );
    expect(buildQuotaScopeKey({ kind: "student", studentId: "s1" }, "HARD")).toBe(
      "student:s1|HARD",
    );
    expect(quotaScopeColumns({ kind: "student", studentId: "s1" })).toEqual({
      classroomId: null,
      studentId: "s1",
    });
  });
});

describe("resolveDifficultyQuotas (nível × dificuldade)", () => {
  const set = ["EASY", "MEDIUM", "HARD"] as const;
  const defaults = [
    q({ difficulty: "EASY", quantity: 3 }),
    q({ difficulty: "MEDIUM", quantity: 2 }),
    q({ difficulty: "HARD", quantity: 1 }),
  ];

  it("exemplo do PO: 3 fáceis + 2 médios + 1 difícil = 6", () => {
    const r = resolveDifficultyQuotas(defaults, { studentId: "s1" }, set);
    expect(qty(r)).toEqual({ EASY: 3, MEDIUM: 2, HARD: 1 });
    expect(r.total).toBe(6);
    expect(r.perDifficulty.every((d) => d.source === "default")).toBe(true);
  });

  it("turma e aluno sobrescrevem só a dificuldade que cadastraram", () => {
    const quotas = [
      ...defaults,
      q({ difficulty: "MEDIUM", classroomId: "c1", quantity: 4 }),
      q({ difficulty: "HARD", studentId: "s1", quantity: 0 + 2 }),
      q({ difficulty: "HARD", classroomId: "c1", quantity: 5 }),
    ];
    const r = resolveDifficultyQuotas(quotas, { studentId: "s1", classroomIds: ["c1"] }, set);
    expect(qty(r)).toEqual({ EASY: 3, MEDIUM: 4, HARD: 2 });
    expect(r.perDifficulty.map((d) => d.source)).toEqual(["default", "classroom", "student"]);
    expect(r.total).toBe(9);
  });

  it("várias turmas: a maior; cotas de outro aluno/turma são ignoradas", () => {
    const quotas = [
      q({ classroomId: "c1", quantity: 2 }),
      q({ classroomId: "c2", quantity: 5 }),
      q({ studentId: "s2", quantity: 9 }),
      q({ classroomId: "c9", quantity: 7 }),
    ];
    const r = resolveDifficultyQuotas(quotas, { studentId: "s1", classroomIds: ["c1", "c2"] }, [
      "EASY",
    ]);
    expect(qty(r)).toEqual({ EASY: 5 });
  });

  it("nível configurado: dificuldade sem registro = 0; fora do conjunto é ignorada", () => {
    const r = resolveDifficultyQuotas(
      [q({ difficulty: "EASY", quantity: 3 }), q({ difficulty: "VERY_HARD", quantity: 4 })],
      { studentId: "s1" },
      set,
    );
    expect(qty(r)).toEqual({ EASY: 3, MEDIUM: 0, HARD: 0 });
    expect(r.perDifficulty[1].source).toBe("none");
    expect(r.total).toBe(3);
  });

  it("nível sem cota aplicável: padrão por dificuldade do conjunto", () => {
    const r = resolveDifficultyQuotas([q({ studentId: "outro" })], { studentId: "s1" }, set);
    expect(qty(r)).toEqual({
      EASY: DEFAULT_QUOTA_PER_DIFFICULTY,
      MEDIUM: DEFAULT_QUOTA_PER_DIFFICULTY,
      HARD: DEFAULT_QUOTA_PER_DIFFICULTY,
    });
    expect(r.perDifficulty.every((d) => d.source === "fallback")).toBe(true);
  });
});
