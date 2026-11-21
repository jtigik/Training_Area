import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./contracts";
import { createHttpServices } from "./http";

afterEach(() => vi.unstubAllGlobals());

describe("http services", () => {
  it("monta query string e método", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await createHttpServices().users.list({ search: "ana", role: "ADMIN", page: 2 });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/users?search=ana&role=ADMIN&page=2");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("converte erro em ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: "email_duplicado", message: "Duplicado" }), {
            status: 409,
          }),
        ),
    );
    const err = await createHttpServices()
      .users.create({ name: "a", email: "a@a.com", role: "STUDENT", onboarding: "convite" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: "email_duplicado" });
  });

  it("aceita 204 sem corpo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(createHttpServices().sections.remove("x")).resolves.toBeUndefined();
  });
});
