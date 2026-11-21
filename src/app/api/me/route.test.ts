import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const { requireSession, getTenantSummary } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  getTenantSummary: vi.fn(),
}));

vi.mock("@/server/auth/session", () => ({ requireSession }));
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

  it("401 sem sessão no formato padrão de erro", async () => {
    requireSession.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "Não autenticado"));
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Não autenticado" },
    });
  });
});
