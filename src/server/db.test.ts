import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("prisma preguiçoso (src/server/db.ts)", () => {
  const saved = process.env.DATABASE_URL;
  afterEach(() => {
    process.env.DATABASE_URL = saved;
    delete (globalThis as { prisma?: unknown }).prisma;
    vi.resetModules();
  });

  it("importar sem DATABASE_URL não falha; o erro só vem no primeiro uso", async () => {
    delete process.env.DATABASE_URL;
    delete (globalThis as { prisma?: unknown }).prisma;
    vi.resetModules();
    const { prisma } = await import("./db");
    await import("./tenant-db");
    // metadados estáticos (lidos pelo adapter do Better Auth no build) não exigem banco
    expect((prisma as unknown as { _runtimeDataModel: unknown })._runtimeDataModel).toHaveProperty(
      "models.User",
    );
    expect(() => prisma.user).toThrow(/DATABASE_URL/);
  });

  it("com DATABASE_URL cria um único cliente reutilizado", async () => {
    process.env.DATABASE_URL = "postgresql://u:p@127.0.0.1:1/x";
    delete (globalThis as { prisma?: unknown }).prisma;
    vi.resetModules();
    const { prisma, getPrisma } = await import("./db");
    expect(typeof prisma.$transaction).toBe("function");
    expect(getPrisma()).toBe(getPrisma());
    expect(typeof prisma.user.findMany).toBe("function");
  });
});
