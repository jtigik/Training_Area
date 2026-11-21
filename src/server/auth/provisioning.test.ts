import { describe, expect, it } from "vitest";

import { decideProvisioning, emailDomain } from "./provisioning";

const now = new Date("2026-11-21T12:00:00Z");
const inv = (over: Partial<Parameters<typeof decideProvisioning>[1][number]> = {}) => ({
  id: "i1",
  tenantId: "t1",
  role: "PROFESSOR" as const,
  expiresAt: new Date("2026-12-01T00:00:00Z"),
  createdAt: new Date("2026-11-20T00:00:00Z"),
  ...over,
});

describe("decideProvisioning", () => {
  it("convite válido define tenant e papel", () => {
    expect(decideProvisioning("p@x.com", [inv()], [], now)).toEqual({
      tenantId: "t1",
      role: "PROFESSOR",
      invitationId: "i1",
    });
  });

  it("ignora convite expirado e usa o mais recente", () => {
    const expired = inv({ id: "old", expiresAt: new Date("2026-11-01T00:00:00Z") });
    const recent = inv({ id: "new", tenantId: "t2", createdAt: new Date("2026-11-21T00:00:00Z") });
    expect(decideProvisioning("p@x.com", [expired, inv(), recent], [], now)?.invitationId).toBe(
      "new",
    );
    expect(decideProvisioning("p@x.com", [expired], [], now)).toBeNull();
  });

  it("domínio da instituição → ALUNO", () => {
    expect(
      decideProvisioning(
        "a@Escola.edu.br",
        [],
        [{ id: "t1", emailDomains: ["escola.edu.br"], autoJoinByDomain: true, active: true }],
        now,
      ),
    ).toEqual({
      tenantId: "t1",
      role: "ALUNO",
      invitationId: null,
    });
  });

  it("domínio ambíguo ou desconhecido → recusado", () => {
    const tenants = [
      { id: "t1", emailDomains: ["x.com"], autoJoinByDomain: true, active: true },
      { id: "t2", emailDomains: ["x.com"], autoJoinByDomain: true, active: true },
    ];
    expect(decideProvisioning("a@x.com", [], tenants, now)).toBeNull();
    expect(decideProvisioning("a@gmail.com", [], [], now)).toBeNull();
  });

  it("autoJoinByDomain desligado (padrão) ou instituição inativa → exige convite", () => {
    const off = { id: "t1", emailDomains: ["x.com"], autoJoinByDomain: false, active: true };
    const inactive = { id: "t2", emailDomains: ["x.com"], autoJoinByDomain: true, active: false };
    expect(decideProvisioning("a@x.com", [], [off], now)).toBeNull();
    expect(decideProvisioning("a@x.com", [], [inactive], now)).toBeNull();
    // Com convite, entra com o papel do convite mesmo com autoJoin desligado.
    expect(decideProvisioning("a@x.com", [inv()], [off], now)?.role).toBe("PROFESSOR");
    // Só uma instituição com autoJoin ligado no domínio → ALUNO (as outras não contam).
    const on = { id: "t3", emailDomains: ["x.com"], autoJoinByDomain: true, active: true };
    expect(decideProvisioning("a@x.com", [], [off, on], now)).toEqual({
      tenantId: "t3",
      role: "ALUNO",
      invitationId: null,
    });
  });

  it("emailDomain", () => {
    expect(emailDomain("Fulano@Escola.EDU.br")).toBe("escola.edu.br");
  });
});
