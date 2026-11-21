import { describe, expect, it } from "vitest";

import { canReadTenantRecord, canWriteTenantRecord, resolveTenantScope } from "./tenant";

const superAdmin = { role: "SUPER_ADMIN", tenantId: null } as const;
const professor = { role: "PROFESSOR", tenantId: "t1" } as const;

describe("resolveTenantScope", () => {
  it("usuário de instituição usa o próprio tenant", () => {
    expect(resolveTenantScope(professor)).toEqual({ ok: true, tenantId: "t1" });
    expect(resolveTenantScope(professor, "t1")).toEqual({ ok: true, tenantId: "t1" });
  });

  it("bloqueia acesso a outro tenant", () => {
    expect(resolveTenantScope(professor, "t2")).toEqual({
      ok: false,
      status: 403,
      code: "CROSS_TENANT",
    });
  });

  it("usuário sem tenant (inconsistente) é bloqueado", () => {
    expect(resolveTenantScope({ role: "ALUNO", tenantId: null })).toMatchObject({
      ok: false,
      code: "NO_TENANT",
    });
  });

  it("SUPER_ADMIN atravessa tenants, mas precisa informar qual", () => {
    expect(resolveTenantScope(superAdmin, "t2")).toEqual({ ok: true, tenantId: "t2" });
    expect(resolveTenantScope(superAdmin)).toEqual({
      ok: false,
      status: 400,
      code: "TENANT_REQUIRED",
    });
  });
});

describe("registros globais", () => {
  it("todos leem globais; só SUPER_ADMIN escreve", () => {
    expect(canReadTenantRecord(professor, null)).toBe(true);
    expect(canWriteTenantRecord(professor, null)).toBe(false);
    expect(canWriteTenantRecord(superAdmin, null)).toBe(true);
  });

  it("registro de outro tenant não é legível nem gravável", () => {
    expect(canReadTenantRecord(professor, "t2")).toBe(false);
    expect(canWriteTenantRecord(professor, "t2")).toBe(false);
    expect(canWriteTenantRecord(professor, "t1")).toBe(true);
  });
});
