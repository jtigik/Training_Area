import { describe, expect, it } from "vitest";

import { toSessionUser } from "./session-user";

const base = { id: "u1", name: "U", email: "u@x" };

describe("toSessionUser", () => {
  it("aceita usuário de instituição e SUPER_ADMIN sem tenant", () => {
    expect(toSessionUser({ ...base, role: "ALUNO", tenantId: "t1" })?.tenantId).toBe("t1");
    expect(toSessionUser({ ...base, role: "SUPER_ADMIN", tenantId: null })?.role).toBe(
      "SUPER_ADMIN",
    );
  });

  it("recusa inativo, papel inválido e combinação papel/tenant incoerente", () => {
    expect(toSessionUser({ ...base, role: "ALUNO", tenantId: "t1", active: false })).toBeNull();
    expect(toSessionUser({ ...base, role: "ADMIN", tenantId: "t1" })).toBeNull();
    expect(toSessionUser({ ...base, role: "ALUNO", tenantId: null })).toBeNull();
    expect(toSessionUser({ ...base, role: "SUPER_ADMIN", tenantId: "t1" })).toBeNull();
  });
});
