import { afterEach, describe, expect, it, vi } from "vitest";
import { httpApi } from "./http";
import { validationIssues } from "./types";

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("httpApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls the student API under /api/aluno", async () => {
    const fetch = mockFetch({ attemptId: "a" }, 201);
    await httpApi.submitAttempt("ex 1", { submission: "=A1" });
    expect(fetch.mock.calls[0][0]).toBe("/api/aluno/exercises/ex%201/attempts");
    mockFetch({});
    await httpApi.retakeLevel("FUNDAMENTAL");
    expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toBe("/api/aluno/levels/FUNDAMENTAL/redo");
  });

  it("drops the Dashboard level (v1.1) from the trail", async () => {
    mockFetch({
      set: { id: "s", name: "S" },
      generalSections: [],
      levels: [{ level: "FUNDAMENTAL" }, { level: "DASHBOARD" }],
    });
    const trail = await httpApi.getTrail();
    expect(trail.levels.map((l) => l.level)).toEqual(["FUNDAMENTAL"]);
  });

  it("keeps error.details and exposes VALIDATION_ERROR issues", async () => {
    mockFetch(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: [{ path: "submission", message: "Obrigatório", code: "too_small" }, 42],
        },
      },
      422,
    );
    const err = await httpApi.submitAttempt("ex", { submission: "" }).catch((e: unknown) => e);
    expect(err).toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Dados inválidos",
    });
    expect(validationIssues(err)).toEqual([
      { path: "submission", message: "Obrigatório", code: "too_small" },
    ]);
    expect(validationIssues(new Error("x"))).toEqual([]);
  });

  it("treats Dashboard exercises as not found", async () => {
    mockFetch({ id: "x", level: "DASHBOARD" });
    await expect(httpApi.getExercise("x")).rejects.toMatchObject({ status: 404 });
  });

  it("reads the session from /api/me and maps 401", async () => {
    const fetch = mockFetch({ user: { id: "u", role: "ALUNO", tenantId: "t" } });
    expect((await httpApi.me()).role).toBe("ALUNO");
    expect(fetch.mock.calls[0][0]).toBe("/api/me");
    mockFetch({ error: { code: "UNAUTHENTICATED", message: "x" } }, 401);
    await expect(httpApi.me()).rejects.toMatchObject({ status: 401 });
  });

  it("surfaces Backend 2 error codes (422 EMPTY_SUBMISSION, 409 ALREADY_SUBMITTED)", async () => {
    mockFetch({ error: { code: "ALREADY_SUBMITTED", message: "Já enviado." } }, 409);
    await expect(httpApi.submitAttempt("x", { submission: "=A1" })).rejects.toMatchObject({
      status: 409,
      code: "ALREADY_SUBMITTED",
    });
  });
});
