/** Faixas padrão da plataforma: só instituições novas recebem a cópia. npm run test:db. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/tenant-summary", () => ({ invalidateTenantSummary: () => {} }));

const enabled = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!enabled)("grading defaults (Q-S1)", () => {
  let prisma: (typeof import("@/server/db"))["prisma"];
  let defaults: typeof import("@/server/platform/grading-defaults");
  let tenants: typeof import("@/server/platform/tenants");
  let saId: string;
  const slugs = ["it-defaults-a", "it-defaults-b"];

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db"));
    defaults = await import("@/server/platform/grading-defaults");
    tenants = await import("@/server/platform/tenants");
    saId = (await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } })).id;
    await prisma.tenant.deleteMany({ where: { slug: { in: slugs } } });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { in: slugs } } });
    await defaults.setGradingDefaults(saId, {
      edMinPercent: 50,
      dMinPercent: 70,
      pdMinPercent: 90,
    });
  });

  it("nova instituição copia o padrão; mudar o padrão não altera as existentes", async () => {
    expect(await defaults.getGradingDefaults()).toEqual({
      edMinPercent: 50,
      dMinPercent: 70,
      pdMinPercent: 90,
    });
    const a = await tenants.createTenant({
      name: "IT A",
      slug: slugs[0]!,
      emailDomains: [],
      autoJoinByDomain: false,
      locale: "pt-BR",
    });
    expect(a.gradingBands).toEqual({ edMinPercent: 50, dMinPercent: 70, pdMinPercent: 90 });

    await defaults.setGradingDefaults(saId, {
      edMinPercent: 40,
      dMinPercent: 60,
      pdMinPercent: 85,
    });
    const b = await tenants.createTenant({
      name: "IT B",
      slug: slugs[1]!,
      emailDomains: [],
      autoJoinByDomain: false,
      locale: "pt-BR",
    });
    const configs = await prisma.tenantGradingConfig.findMany({
      where: { tenantId: { in: [a.id, b.id] } },
      select: { tenantId: true, edMinPercent: true, dMinPercent: true, pdMinPercent: true },
    });
    const byId = Object.fromEntries(configs.map((c) => [c.tenantId, c]));
    expect(byId[a.id]).toMatchObject({ edMinPercent: 50, dMinPercent: 70, pdMinPercent: 90 });
    expect(byId[b.id]).toMatchObject({ edMinPercent: 40, dMinPercent: 60, pdMinPercent: 85 });
    expect(
      await prisma.auditLog.count({
        where: { action: "grading_defaults.updated", actorId: saId },
      }),
    ).toBeGreaterThan(0);
  });

  it("CHECK do banco recusa faixas inválidas", async () => {
    await expect(
      prisma.platformGradingDefaults.update({
        where: { id: "platform" },
        data: { edMinPercent: 80, dMinPercent: 70 },
      }),
    ).rejects.toThrow();
  });
});
