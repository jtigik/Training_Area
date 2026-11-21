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
    expect(me).toMatchObject({
      role: "ALUNO",
      tenantId: "inst-exemplo",
      tenant: { name: "Instituto Exemplo" },
    });
    expect(document.cookie).toContain("better-auth.session_token=mock.ALUNO.");
  });

  it("forbids the student API for other roles", async () => {
    mockSignInAs("u-prof");
    await expect(mockApi.getTrail()).rejects.toMatchObject({ status: 403 });
  });

  it("requires a session", async () => {
    await expect(mockApi.getTrail()).rejects.toMatchObject({ status: 401 });
    await login();
    expect((await mockApi.me()).role).toBe("ALUNO");
    await mockApi.logout();
    await expect(mockApi.me()).rejects.toMatchObject({ status: 401 });
  });

  it("starts with the first level open and the others locked", async () => {
    await login();
    const trail = await mockApi.getTrail();
    // Dashboard is v1.1 and is not part of the MVP at all.
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
    // The final submission is unique per exercise.
    await expect(
      mockApi.submitAttempt("ex-soma", { submission: "=SOMA(B2:B6)" }),
    ).rejects.toMatchObject({ status: 409, code: "ALREADY_SUBMITTED" });

    const answers: Record<string, string> = {
      "e2e-soma-basica": "=soma(a1:a3)",
      "ex-media": "=MÉDIA(B2:B5)",
      "ex-maximo": "=MÁXIMO(B2:B8)",
      "ex-minimo": "=MIN(B2:B8)",
    };
    let last;
    for (const [id, submission] of Object.entries(answers)) {
      last = await mockApi.submitAttempt(id, { submission });
      expect(last.correct).toBe(true);
    }
    // 4/5 = 80% -> D, which unlocks the next level.
    expect(last).toMatchObject({
      levelCompleted: true,
      levelStatus: "COMPLETED",
      concept: "D",
      bestConcept: "D",
    });

    const trail = await mockApi.getTrail();
    expect(trail.levels[1].status).toBe("NOT_STARTED");

    mockConfig.reviewDelayMs = 60_000;
    const inReview = await mockApi.getLevelFeedback("FUNDAMENTAL");
    expect(inReview).toMatchObject({
      status: "IN_REVIEW",
      message: null,
      concept: "D",
      bestConcept: "D",
      run: 1,
    });
    expect(inReview.score).toEqual({ correct: 4, total: 5, percent: 80 });
    expect(inReview.attempts).toBe(5);

    mockConfig.reviewDelayMs = 0;
    const published = await mockApi.getLevelFeedback("FUNDAMENTAL");
    expect(published.status).toBe("PUBLISHED");
    expect(published.message?.paragraphs[0]).toContain("80%");
    expect(published.message?.toReview[0]).toContain("Total de vendas da semana");
    expect(published.nextLevel).toMatchObject({ level: "PROFESSIONAL", unlocked: true });

    // D cannot be redone.
    await expect(mockApi.retakeLevel("FUNDAMENTAL")).rejects.toMatchObject({
      status: 409,
      code: "LEVEL_NOT_REDOABLE",
    });
  });

  it("ND/ED locks the next level; redo is unlimited and the best concept counts", async () => {
    await login();
    const ids = ["e2e-soma-basica", "ex-soma", "ex-media", "ex-maximo", "ex-minimo"];
    const good: Record<string, string> = {
      "e2e-soma-basica": "=SOMA(A1:A3)",
      "ex-soma": "=SOMA(B2:B6)",
      "ex-media": "=MÉDIA(B2:B5)",
      "ex-maximo": "=MÁXIMO(B2:B8)",
      "ex-minimo": "=MÍNIMO(B2:B8)",
    };
    // Run 1: 3/5 = 60% -> ED.
    for (const [i, id] of ids.entries()) {
      await mockApi.submitAttempt(id, { submission: i < 3 ? good[id] : "=A1" });
    }
    let trail = await mockApi.getTrail();
    expect(trail.levels[0]).toMatchObject({
      status: "COMPLETED",
      concept: "ED",
      bestConcept: "ED",
      run: 1,
    });
    expect(trail.levels[1].status).toBe("LOCKED");
    expect((await mockApi.getLevelFeedback("FUNDAMENTAL")).nextLevel?.unlocked).toBe(false);

    // Run 2: 0/5 -> ND, but the best concept stays ED and the next level stays locked.
    let level = await mockApi.retakeLevel("FUNDAMENTAL");
    expect(level).toMatchObject({ status: "IN_PROGRESS", concept: null, run: 2 });
    expect(level.progress.done).toBe(0);
    for (const id of ids) await mockApi.submitAttempt(id, { submission: "=A1" });
    trail = await mockApi.getTrail();
    expect(trail.levels[0]).toMatchObject({ concept: "ND", bestConcept: "ED", run: 2 });
    expect(trail.levels[1].status).toBe("LOCKED");

    // Run 3: 5/5 -> PD unlocks the next level; no more redo.
    level = await mockApi.retakeLevel("FUNDAMENTAL");
    expect(level.run).toBe(3);
    for (const id of ids) await mockApi.submitAttempt(id, { submission: good[id] });
    trail = await mockApi.getTrail();
    expect(trail.levels[0]).toMatchObject({ concept: "PD", bestConcept: "PD" });
    expect(trail.levels[1].status).toBe("NOT_STARTED");
    await expect(mockApi.retakeLevel("FUNDAMENTAL")).rejects.toMatchObject({ status: 409 });
  });

  it("rejects empty and over-limit answers without counting an attempt", async () => {
    await login();
    await expect(mockApi.submitAttempt("ex-soma", { submission: "   " })).rejects.toMatchObject({
      status: 422,
      code: "EMPTY_SUBMISSION",
    });
    await expect(
      mockApi.submitAttempt("ex-soma", { submission: "=B2" + "+0".repeat(1001) }),
    ).rejects.toMatchObject({ status: 422, code: "LIMIT_EXCEEDED" });
    const exercise = await mockApi.getExercise("ex-soma");
    expect(exercise).toMatchObject({ attempts: 0, status: "NOT_STARTED" });
  });

  it("lists Google and Microsoft as login options", async () => {
    const opts = await mockApi.getLoginOptions();
    expect(opts.providers.map((p) => p.id)).toEqual(["google", "microsoft"]);
  });

  it("has an answer key that its own grader accepts for every exercise (sanity check)", async () => {
    const { gradeSubmission } = await import("@/lib/formula/check");
    const solutions: Record<string, string> = {
      "e2e-soma-basica": "=SUM(A1:A3)",
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
