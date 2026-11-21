import { beforeEach, describe, expect, it } from "vitest";
import { MOCK_EXERCISES } from "./data";
import { mockApi, mockConfig, mockSignInAs, resetMockState } from "./index";

const login = () => mockApi.startLogin("google", "/aluno");

describe("mock student API", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMockState();
  });

  it("signs in through the (mock) social provider and exposes the institution", async () => {
    const start = await login();
    expect(start.kind).toBe("signed-in");
    const me = await mockApi.me();
    expect(me).toMatchObject({ role: "STUDENT", institution: { name: "Instituto Exemplo" } });
    expect(document.cookie).toContain("better-auth.session_token=mock.STUDENT.");
  });

  it("forbids the student API for other roles", async () => {
    mockSignInAs("u-prof");
    await expect(mockApi.getTrail()).rejects.toMatchObject({ status: 403 });
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
    // Dashboard is v1.1 ("em breve") and is not part of the trail.
    expect(trail.levels.map((l) => l.level)).toEqual(["FUNDAMENTAL", "PROFESSIONAL", "ADVANCED"]);
    expect(trail.levels.map((l) => l.status)).toEqual(["NOT_STARTED", "LOCKED", "LOCKED"]);
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

    mockConfig.reviewDelayMs = 60_000;
    const inReview = await mockApi.getLevelFeedback("FUNDAMENTAL");
    expect(inReview).toMatchObject({ status: "IN_REVIEW", message: null, concept: "PD" });
    expect(inReview.score).toEqual({ correct: 4, total: 4, percent: 100 });
    expect(inReview.attempts).toBe(5);

    mockConfig.reviewDelayMs = 0;
    const published = await mockApi.getLevelFeedback("FUNDAMENTAL");
    expect(published.status).toBe("PUBLISHED");
    expect(published.message?.paragraphs[0]).toContain("100%");
    expect(published.message?.toReview[0]).toContain("Total de vendas da semana");
    expect(published.nextLevel?.level).toBe("PROFESSIONAL");

    // PD cannot be retaken.
    await expect(mockApi.retakeLevel("FUNDAMENTAL")).rejects.toMatchObject({ status: 409 });
  });

  it("lets the student redo a level completed with ND/ED", async () => {
    await login();
    for (const id of ["ex-soma", "ex-media", "ex-maximo", "ex-minimo"]) {
      await mockApi.submitAttempt(id, { submission: "=B2" });
    }
    let trail = await mockApi.getTrail();
    expect(trail.levels[0]).toMatchObject({ status: "COMPLETED", concept: "ND" });
    const level = await mockApi.retakeLevel("FUNDAMENTAL");
    expect(level).toMatchObject({ status: "NOT_STARTED", concept: null });
    expect(level.progress.done).toBe(0);
    trail = await mockApi.getTrail();
    expect(trail.levels[1].status).toBe("LOCKED");
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
