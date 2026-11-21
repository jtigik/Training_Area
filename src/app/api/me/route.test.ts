import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSession, getTenantSummary, AuthError } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getTenantSummary: vi.fn(),
  AuthError: class AuthError extends Error {},
}));

vi.mock("@/server/auth/session", () => {
  return {
    requireSession,
    authErrorResponse: (e: unknown) =>
      e instanceof AuthError
        ? Response.json({ error: "Não autenticado" }, { status: 401 })
        : Promise.reject(e),
    AuthError,
  };
});
vi.mock("@/server/auth/tenant-summary", () => ({ getTenantSummary }));

const { GET } = await import("./route");

const req = () => new Request("http://localhost/api/me");

describe("GET /api/me", () => {
  beforeEach(() => {
    requireSession.mockReset();
    getTenantSummary.mockReset();
  });

  it("inclui tenant { id, name, slug } para usuário de instituição", async () => {
    requireSession.mockResolvedValue({
      sessionId: "s",
      user: {
        id: "u1",
        name: "Aluno",
        email: "aluno@escola-demo.local",
        role: "ALUNO",
        tenantId: "t1",
      },
    });
    getTenantSummary.mockResolvedValue({ id: "t1", name: "Escola Demo", slug: "escola-demo" });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: {
        id: "u1",
        name: "Aluno",
        email: "aluno@escola-demo.local",
        role: "ALUNO",
        tenantId: "t1",
        tenant: { id: "t1", name: "Escola Demo", slug: "escola-demo" },
      },
    });
    expect(getTenantSummary).toHaveBeenCalledWith("t1");
  });

  it("tenant null para SUPER_ADMIN", async () => {
    requireSession.mockResolvedValue({
      sessionId: "s",
      user: {
        id: "sa",
        name: "SA",
        email: "admin@training-area.local",
        role: "SUPER_ADMIN",
        tenantId: null,
      },
    });
    getTenantSummary.mockResolvedValue(null);
    const body = await (await GET(req())).json();
    expect(body.user.tenant).toBeNull();
  });

  it("401 sem sessão", async () => {
    requireSession.mockRejectedValue(new AuthError());
    expect((await GET(req())).status).toBe(401);
  });
});
