import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/api";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push, refresh: vi.fn() }),
  usePathname: () => "/aluno",
  useSearchParams: () => new URLSearchParams(),
}));

const me = vi.fn<() => Promise<SessionUser>>();
vi.mock("@/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, me: () => me() } };
});

const { StudentShell } = await import("./student-shell");

const tenant = { id: "t1", name: "Escola Demo", slug: "escola-demo" };
const user = (role: SessionUser["role"]): SessionUser =>
  ({
    id: `u-${role}`,
    name: "Fulano de Tal",
    email: "f@escola.local",
    role,
    tenantId: role === "SUPER_ADMIN" ? null : tenant.id,
    tenant: role === "SUPER_ADMIN" ? null : tenant,
  }) as SessionUser;

describe("StudentShell", () => {
  beforeEach(() => {
    replace.mockReset();
    me.mockReset();
  });

  it("renders the student area for ALUNO", async () => {
    me.mockResolvedValue(user("ALUNO"));
    render(<StudentShell>conteúdo do aluno</StudentShell>);
    expect(await screen.findByText("conteúdo do aluno")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    ["PROFESSOR", "/professor/resultados"],
    ["INSTITUTION_ADMIN", "/admin/usuarios"],
    ["SUPER_ADMIN", "/super-admin/instituicoes"],
  ] as const)("redirects %s to its own area home (no 403 view)", async (role, home) => {
    me.mockResolvedValue(user(role));
    render(<StudentShell>conteúdo do aluno</StudentShell>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(home));
    expect(screen.queryByText("conteúdo do aluno")).not.toBeInTheDocument();
    expect(screen.queryByText(/Acesso negado/)).not.toBeInTheDocument();
  });
});
