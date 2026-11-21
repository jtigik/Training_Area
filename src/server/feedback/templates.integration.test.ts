/** FeedbackTemplate: escopo tenant + globais legíveis, nome único. npm run test:db. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.RUN_DB_TESTS === "1";
const T = "tenant-escola-demo";
const OTHER = "tenant-it-templates-outra";

describe.skipIf(!enabled)("FeedbackTemplate (escopo e unicidade)", () => {
  let prisma: (typeof import("@/server/db"))["prisma"];
  let forTenant: (typeof import("@/server/tenant-db"))["forTenant"];
  const ids: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db"));
    ({ forTenant } = await import("@/server/tenant-db"));
    await prisma.tenant.create({ data: { id: OTHER, name: "Outra IT tpl", slug: "outra-it-tpl" } });
    ids.push(
      (
        await prisma.feedbackTemplate.create({
          data: { name: "IT global ND", concept: "ND", body: "g" },
        })
      ).id,
      (
        await prisma.feedbackTemplate.create({
          data: { tenantId: OTHER, name: "IT da outra", body: "o" },
        })
      ).id,
    );
  });

  afterAll(async () => {
    await prisma.feedbackTemplate.deleteMany({ where: { id: { in: ids } } });
    await prisma.feedbackTemplate.deleteMany({
      where: { name: { startsWith: "IT " }, tenantId: T },
    });
    await prisma.tenant.deleteMany({ where: { id: OTHER } });
  });

  it("instituição cria o seu (tenantId carimbado) e lê o próprio + globais, nunca de outra", async () => {
    const db = forTenant(T);
    const own = await db.feedbackTemplate.create({
      data: { tenantId: T, name: "IT própria", knowledgeLevel: "FUNDAMENTAL", body: "p" },
    });
    expect(own.tenantId).toBe(T);
    const names = (
      await db.feedbackTemplate.findMany({ where: { name: { startsWith: "IT " } } })
    ).map((t) => t.name);
    expect(names.sort()).toEqual(["IT global ND", "IT própria"]);
  });

  it("tenant não grava global nem altera global", async () => {
    const db = forTenant(T);
    await expect(
      db.feedbackTemplate.create({
        data: { tenantId: null, name: "IT burla", body: "x" } as never,
      }),
    ).rejects.toThrow();
    const res = await db.feedbackTemplate.updateMany({
      where: { id: ids[0] },
      data: { body: "alterado" },
    });
    expect(res.count).toBe(0);
  });

  it("nome único por instituição e entre globais", async () => {
    await expect(
      prisma.feedbackTemplate.create({ data: { tenantId: T, name: "IT própria", body: "dup" } }),
    ).rejects.toThrow();
    await expect(
      prisma.feedbackTemplate.create({ data: { name: "IT global ND", body: "dup" } }),
    ).rejects.toThrow();
    // mesmo nome em outra instituição é permitido
    const ok = await prisma.feedbackTemplate.create({
      data: { tenantId: OTHER, name: "IT própria", body: "ok" },
    });
    ids.push(ok.id);
  });
});
