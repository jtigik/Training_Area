import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getGradingBands, overrideLevelConcept, GradingError } = await import("./service");

type AnyDb = Parameters<typeof getGradingBands>[0];

describe("getGradingBands", () => {
  it("sem configuração da instituição → padrão ND<50, ED 50-69, D 70-89, PD>=90", async () => {
    const db = { tenantGradingConfig: { findFirst: vi.fn().mockResolvedValue(null) } };
    expect(await getGradingBands(db as unknown as AnyDb)).toEqual({
      edMinPercent: 50,
      dMinPercent: 70,
      pdMinPercent: 90,
    });
  });

  it("usa as faixas configuradas pela instituição", async () => {
    const cfg = { edMinPercent: 40, dMinPercent: 60, pdMinPercent: 85 };
    const db = { tenantGradingConfig: { findFirst: vi.fn().mockResolvedValue(cfg) } };
    expect(await getGradingBands(db as unknown as AnyDb)).toEqual(cfg);
  });
});

describe("overrideLevelConcept", () => {
  function fakeDb(attempt: object | null) {
    const tx = {
      levelAttempt: {
        findFirst: vi.fn().mockResolvedValue(attempt),
        update: vi.fn().mockImplementation(({ data }) => ({ ...attempt, ...data })),
      },
      conceptOverride: { create: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const db = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
    return { db, tx };
  }
  const ctx = (db: unknown) =>
    ({ db, tenantId: "t1", user: { id: "prof" } }) as unknown as Parameters<
      typeof overrideLevelConcept
    >[0];

  it("registra justificativa na tentativa e em concept_overrides (computedConcept intacto)", async () => {
    const { db, tx } = fakeDb({ id: "la", status: "COMPLETED", concept: "ED" });
    const reason = "Demonstrou domínio em sala de aula";
    const result = await overrideLevelConcept(ctx(db), "la", { concept: "D", reason });
    expect(tx.conceptOverride.create).toHaveBeenCalledWith({
      select: { id: true },
      data: expect.objectContaining({
        levelAttemptId: "la",
        fromConcept: "ED",
        toConcept: "D",
        reason,
        overriddenById: "prof",
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "level_attempt.concept_overridden",
        entityId: "la",
        actorId: "prof",
      }),
    });
    const update = tx.levelAttempt.update.mock.calls[0]![0].data;
    expect(update).toMatchObject({ concept: "D", overriddenById: "prof", overrideReason: reason });
    expect(update.overriddenAt).toBeInstanceOf(Date);
    expect(update).not.toHaveProperty("computedConcept");
    expect(result.concept).toBe("D");
  });

  it("recusa tentativa não concluída, inexistente ou conceito igual", async () => {
    const reason = "Justificativa suficiente";
    await expect(
      overrideLevelConcept(
        ctx(fakeDb({ id: "la", status: "IN_PROGRESS", concept: null }).db),
        "la",
        {
          concept: "D",
          reason,
        },
      ),
    ).rejects.toMatchObject({ code: "NOT_COMPLETED" });
    await expect(
      overrideLevelConcept(ctx(fakeDb(null).db), "x", { concept: "D", reason }),
    ).rejects.toBeInstanceOf(GradingError);
    await expect(
      overrideLevelConcept(ctx(fakeDb({ id: "la", status: "COMPLETED", concept: "D" }).db), "la", {
        concept: "D",
        reason,
      }),
    ).rejects.toMatchObject({ code: "SAME_CONCEPT" });
  });
});
