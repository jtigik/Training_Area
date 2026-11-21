import { describe, expect, it } from "vitest";

import { snapshotFromExercise, toStudentItem, type SetExerciseItem } from "./set-exercises";

const base = {
  title: "Soma",
  statement: "Some",
  initialSheet: { cells: {} },
  expectedResult: [{ cell: "A3", value: 3 }],
  gradingRules: { requiredFunctions: ["SOMA"] },
  hint: null,
  level: "FUNDAMENTAL" as const,
  difficulty: "EASY" as const,
};

describe("set-exercises", () => {
  it("snapshot copia só o conteúdo do exercício", () => {
    expect(snapshotFromExercise({ ...base, id: "x", tenantId: "t" } as typeof base)).toEqual(base);
  });

  it("versão do aluno remove gabarito e regras", () => {
    const item: SetExerciseItem = {
      ...base,
      ref: { type: "setExercise", id: "se1" },
      sourceExerciseId: "e1",
      isGlobal: null,
      position: 0,
    };
    const student = toStudentItem(item);
    expect(student).not.toHaveProperty("expectedResult");
    expect(student).not.toHaveProperty("gradingRules");
    expect(student.statement).toBe("Some");
  });
});
