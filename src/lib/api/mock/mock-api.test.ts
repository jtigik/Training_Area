import { beforeEach, describe, expect, it } from "vitest";
import { MOCK_EXERCISES } from "./data";
import { mockApi, resetMockState } from "./index";

const login = () => mockApi.login({ email: "aluno@training.dev", password: "senha123" });

describe("mock student API", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMockState();
  });

  it("rejects bad credentials with a generic message", async () => {
    await expect(mockApi.login({ email: "x@y.z", password: "a" })).rejects.toMatchObject({
      status: 401,
      message: "E-mail ou senha incorretos.",
    });
    await expect(
      mockApi.login({ email: "aluno@training.dev", password: "errada" }),
    ).rejects.toMatchObject({ status: 401, message: "E-mail ou senha incorretos." });
  });

  it("requires a session", async () => {
    await expect(mockApi.getTrail()).rejects.toMatchObject({ status: 401 });
    await login();
    expect((await mockApi.me()).role).toBe("STUDENT");
    await mockApi.logout();
    await expect(mockApi.me()).rejects.toMatchObject({ status: 401 });
  });

  it("starts with the first level open and the others locked", async () => {
    await login();
    const trail = await mockApi.getTrail();
    expect(trail.levels.map((l) => l.status)).toEqual([
      "NOT_STARTED",
      "LOCKED",
      "LOCKED",
      "LOCKED",
    ]);
    expect(trail.levels[1].exercises).toEqual([]);
    await expect(mockApi.getExercise("ex-se")).rejects.toMatchObject({ status: 403 });
  });

  it("never sends the answer key to the client", async () => {
    await login();
    const exercise = await mockApi.getExercise("ex-soma");
    expect(JSON.stringify(exercise)).not.toContain("656");
    expect(exercise).not.toHaveProperty("expected");
  });

  it("grades attempts, completes the level and produces feedback", async () => {
    await login();
    const wrong = await mockApi.submitAttempt("ex-soma", { submission: "=SOMA(B2:B5)" });
    expect(wrong).toMatchObject({ correct: false, feedbackCode: "WRONG_VALUE" });
    expect(wrong.hint).toBeTruthy();

    const answers: Record<string, string> = {
      "ex-soma": "=SOMA(B2:B6)",
      "ex-media": "=MÉDIA(B2:B5)",
      "ex-maximo": "=MÁXIMO(B2:B8)",
      "ex-minimo": "=MIN(B2:B8)",
    };
    let last;
    for (const [id, submission] of Object.entries(answers)) {
      last = await mockApi.submitAttempt(id, { submission });
      expect(last.correct).toBe(true);
    }
    expect(last).toMatchObject({ levelCompleted: true, levelStatus: "COMPLETED" });

    const trail = await mockApi.getTrail();
    expect(trail.levels[1].status).toBe("NOT_STARTED");

    const feedback = await mockApi.getLevelFeedback("FUNDAMENTAL");
    expect(feedback.score).toEqual({ correct: 4, total: 4, percent: 100 });
    expect(feedback.attempts).toBe(5);
    expect(feedback.band.label).toBe("Excelente");
    expect(feedback.toReview[0]).toContain("Total de vendas da semana");
    expect(feedback.nextLevel?.level).toBe("PROFESSIONAL");
  });

  it("has an answer key that its own grader accepts for every exercise (sanity check)", async () => {
    const { gradeSubmission } = await import("@/lib/formula/check");
    const solutions: Record<string, string> = {
      "ex-soma": "=SOMA(B2:B6)",
      "ex-media": "=MÉDIA(B2:B5)",
      "ex-maximo": "=MÁXIMO(B2:B8)",
      "ex-minimo": "=MÍNIMO(B2:B8)",
      "ex-se": '=SE(B2>=7;"Aprovado";"Reprovado")',
      "ex-contse": '=CONT.SE(B2:B7;">=7")',
      "ex-procv": "=PROCV(D2;A2:B5;2;FALSO)",
      "ex-somases": '=SOMASES(C2:C6;B2:B6;"Sul";A2:A6;"Jan")',
    };
    for (const e of MOCK_EXERCISES) {
      const r = gradeSubmission(
        e.sheet.cells,
        e.targetCell,
        solutions[e.id],
        e.expected,
        e.options,
      );
      expect(r, e.id).toMatchObject({ correct: true });
    }
  });
});
