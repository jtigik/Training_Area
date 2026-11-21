import { describe, expect, it } from "vitest";

import { buildQuotaScopeKey, quotaScopeColumns, resolveQuota, type QuotaRecord } from "./quota";

const q = (over: Partial<QuotaRecord>): QuotaRecord => ({
  difficulty: null,
  classroomId: null,
  studentId: null,
  quantity: 1,
  ...over,
});

describe("buildQuotaScopeKey", () => {
  it("bate com o CHECK da migração", () => {
    expect(buildQuotaScopeKey({ kind: "default" }, null)).toBe("default|*");
    expect(buildQuotaScopeKey({ kind: "classroom", classroomId: "c1" }, "EASY")).toBe(
      "classroom:c1|EASY",
    );
    expect(buildQuotaScopeKey({ kind: "student", studentId: "s1" }, null)).toBe("student:s1|*");
    expect(quotaScopeColumns({ kind: "student", studentId: "s1" })).toEqual({
      classroomId: null,
      studentId: "s1",
    });
  });
});

describe("resolveQuota", () => {
  const quotas = [
    q({ quantity: 5 }),
    q({ difficulty: "EASY", quantity: 2 }),
    q({ classroomId: "c1", quantity: 8 }),
    q({ studentId: "s1", quantity: 10 }),
  ];

  it("sem cotas → null", () => {
    expect(resolveQuota([], { studentId: "s9" })).toBeNull();
  });

  it("usa o padrão do nível", () => {
    expect(resolveQuota(quotas, { studentId: "s9" })).toBe(5);
  });

  it("dificuldade específica vence o nível inteiro no mesmo escopo", () => {
    expect(resolveQuota(quotas, { studentId: "s9", difficulty: "EASY" })).toBe(2);
  });

  it("turma vence o padrão; aluno vence turma", () => {
    expect(resolveQuota(quotas, { studentId: "s9", classroomIds: ["c1"] })).toBe(8);
    expect(resolveQuota(quotas, { studentId: "s1", classroomIds: ["c1"] })).toBe(10);
  });

  it("ignora cotas de outro aluno/turma", () => {
    expect(resolveQuota([q({ studentId: "s2", quantity: 9 })], { studentId: "s1" })).toBeNull();
  });

  it("várias turmas: maior quantidade", () => {
    const multi = [q({ classroomId: "c1", quantity: 3 }), q({ classroomId: "c2", quantity: 6 })];
    expect(resolveQuota(multi, { studentId: "s1", classroomIds: ["c1", "c2"] })).toBe(6);
  });
});
