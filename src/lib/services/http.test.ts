import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./contracts";
import { createHttpServices } from "./http";

afterEach(() => vi.unstubAllGlobals());

describe("http services", () => {
  it("monta query string e método", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await createHttpServices().users.list({ search: "ana", role: "INSTITUTION_ADMIN", page: 2 });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/admin/users?search=ana&role=INSTITUTION_ADMIN&page=2",
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("converte erro em ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "email_duplicado", message: "Duplicado" }), {
          status: 409,
        }),
      ),
    );
    const err = await createHttpServices()
      .users.create({ name: "a", email: "a@a.com", role: "ALUNO" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: "email_duplicado" });
  });

  it("usa os endpoints do super admin e da revisão de feedback", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response("{}", { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const s = createHttpServices();
    await s.institutions.update("i1", { active: false });
    await s.reviews.approve("r1", "ok");
    await s.results.redoLevel("u1", "s1", "FUNDAMENTAL");
    expect(fetchMock.mock.calls.map((c) => `${c[1].method} ${c[0]}`)).toEqual([
      "PATCH /api/super-admin/institutions/i1",
      "POST /api/professor/feedback-reviews/r1/approve",
      "POST /api/professor/results/students/u1/redo",
    ]);
  });

  it("aceita 204 sem corpo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(createHttpServices().sections.remove("x")).resolves.toBeUndefined();
  });
});

describe("http: importação .xlsx", () => {
  it("envia multipart e converte o 422 IMPORT_INVALID do BE2", async () => {
    const errors = [
      {
        sheet: "Gabarito",
        row: null,
        column: null,
        cell: null,
        code: "MISSING_ANSWER_KEY",
        message: "Sem gabarito",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "IMPORT_INVALID" }, errors }), {
        status: 422,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const s = createHttpServices();
    const file = new File(["x"], "a.xlsx");
    await expect(s.exercises.importXlsx("set-1", file)).rejects.toMatchObject({
      status: 422,
      code: "IMPORT_INVALID",
      details: { errors },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/professor/sets/set-1/exercises/import");
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
    vi.unstubAllGlobals();
  });
});
