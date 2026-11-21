/**
 * Integração da extensão forTenant com o Postgres real.
 * Roda só com RUN_DB_TESTS=1 (precisa de DATABASE_URL migrado + seed).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!enabled)("forTenant (banco real)", () => {
  const OTHER = "tenant-it-outro";
  let prisma: (typeof import("@/server/db"))["prisma"];
  let forTenant: (typeof import("@/server/tenant-db"))["forTenant"];
  let TenantScopeError: (typeof import("@/server/tenant-db"))["TenantScopeError"];

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db"));
    ({ forTenant, TenantScopeError } = await import("@/server/tenant-db"));
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: OTHER } });
  });

  it("isola dados entre tenants e mostra globais", async () => {
    await prisma.tenant.upsert({
      where: { id: OTHER },
      update: {},
      create: { id: OTHER, name: "Outro", slug: "it-outro" },
    });
    await prisma.exerciseSet.create({
      data: { tenantId: OTHER, name: "Set do outro", difficulties: ["EASY"] },
    });

    const demo = forTenant("tenant-escola-demo");
    const sets = await demo.exerciseSet.findMany({ select: { tenantId: true } });
    expect(sets.length).toBeGreaterThan(0);
    expect(sets.every((s) => s.tenantId === "tenant-escola-demo")).toBe(true);

    const exercises = await demo.exercise.findMany({ select: { tenantId: true, isGlobal: true } });
    expect(exercises.some((e) => e.isGlobal && e.tenantId === null)).toBe(true);

    const other = forTenant(OTHER);
    expect(await other.user.count()).toBe(0);
    expect(await other.exerciseSet.count()).toBe(1);
    // Registro de outro tenant é "inexistente" mesmo por id.
    const demoSet = await prisma.exerciseSet.findFirstOrThrow({
      where: { tenantId: "tenant-escola-demo" },
    });
    expect(await other.exerciseSet.findUnique({ where: { id: demoSet.id } })).toBeNull();
    // Globais não são alteráveis pelo tenant.
    const updated = await other.exercise.updateMany({
      where: { isGlobal: true },
      data: { hint: "x" },
    });
    expect(updated.count).toBe(0);
    await expect(
      other.exerciseSet.create({
        data: { tenantId: "tenant-escola-demo", name: "x", difficulties: [] },
      }),
    ).rejects.toBeInstanceOf(TenantScopeError);
  });

  it("vale dentro de transações interativas", async () => {
    const count = await forTenant(OTHER).$transaction((tx) => tx.exerciseSet.count());
    expect(count).toBe(1);
  });
});
