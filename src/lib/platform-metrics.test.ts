import { describe, expect, it } from "vitest";

import { buildPlatformMetrics } from "./platform-metrics";

const t1 = { id: "t1", name: "Escola A", slug: "a", active: true };
const t2 = { id: "t2", name: "Escola B", slug: "b", active: false };
const c = (n: number) => ({ _count: { _all: n } });

describe("buildPlatformMetrics", () => {
  it("agrega por instituição e no total, sem registros individuais", () => {
    const m = buildPlatformMetrics(
      [t1, t2],
      [
        { tenantId: "t1", role: "ALUNO", ...c(10) },
        { tenantId: "t1", role: "PROFESSOR", ...c(2) },
        { tenantId: "t2", role: "INSTITUTION_ADMIN", ...c(1) },
        { tenantId: null, role: "SUPER_ADMIN", ...c(1) },
      ],
      [
        { tenantId: "t1", status: "COMPLETED", ...c(7) },
        { tenantId: "t1", status: "IN_PROGRESS", ...c(3) },
      ],
      [
        { tenantId: "t1", concept: "D", ...c(4) },
        { tenantId: "t1", concept: "ND", ...c(3) },
      ],
      new Date("2026-11-21T06:00:00Z"),
    );
    expect(m.tenants[0]).toEqual({
      tenant: t1,
      users: { INSTITUTION_ADMIN: 0, PROFESSOR: 2, ALUNO: 10, total: 12 },
      levelAttempts: { total: 10, inProgress: 3, completed: 7, abandoned: 0 },
      concepts: { ND: 3, ED: 0, D: 4, PD: 0 },
    });
    expect(m.tenants[1]!.users.total).toBe(1);
    expect(m.totals).toMatchObject({
      tenants: 2,
      activeTenants: 1,
      users: { total: 13, ALUNO: 10 },
      levelAttempts: { total: 10 },
      concepts: { D: 4, ND: 3 },
    });
    expect(m.generatedAt).toBe("2026-11-21T06:00:00.000Z");
    // Nenhum campo pessoal no resultado.
    expect(JSON.stringify(m)).not.toMatch(/email|studentId|aiText|name":"(?!Escola)/);
  });
});
