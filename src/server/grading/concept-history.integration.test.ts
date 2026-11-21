/** Ajuste de conceito: histórico completo e isolamento por tenant. npm run test:db. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.RUN_DB_TESTS === "1";
const T = "tenant-escola-demo";
const OTHER = "it-tenant-historico";

describe.skipIf(!enabled)("overrideLevelConcept / getConceptHistory", () => {
  let prisma: (typeof import("@/server/db"))["prisma"];
  let forTenant: (typeof import("@/server/tenant-db"))["forTenant"];
  let grading: typeof import("@/server/grading/service");
  let professor: { id: string; name: string };
  let attemptId: string;
  let setId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db"));
    ({ forTenant } = await import("@/server/tenant-db"));
    grading = await import("@/server/grading/service");
    professor = await prisma.user.findUniqueOrThrow({
      where: { email: "professor@escola-demo.local" },
      select: { id: true, name: true },
    });
    const student = await prisma.user.findUniqueOrThrow({
      where: { email: "aluno@escola-demo.local" },
    });
    setId = (
      await prisma.exerciseSet.create({
        data: { tenantId: T, name: "IT histórico", difficulties: ["EASY"] },
      })
    ).id;
    const level = await prisma.level.create({
      data: { tenantId: T, setId, knowledgeLevel: "FUNDAMENTAL" },
    });
    attemptId = (
      await prisma.levelAttempt.create({
        data: {
          tenantId: T,
          studentId: student.id,
          levelId: level.id,
          attemptNumber: 1,
          status: "COMPLETED",
          completedAt: new Date(),
          gradedAt: new Date(),
          computedConcept: "ED",
          concept: "ED",
        },
      })
    ).id;
    await prisma.tenant.deleteMany({ where: { id: OTHER } });
    await prisma.tenant.create({ data: { id: OTHER, name: "Outra", slug: OTHER } });
  });

  afterAll(async () => {
    await prisma.exerciseSet.deleteMany({ where: { id: setId } });
    await prisma.tenant.deleteMany({ where: { id: OTHER } });
  });

  it("dois ajustes → histórico em ordem com autor, justificativa e conceitos", async () => {
    const ctx = { db: forTenant(T), tenantId: T, user: professor } as Parameters<
      typeof grading.overrideLevelConcept
    >[0];
    await grading.overrideLevelConcept(ctx, attemptId, {
      concept: "D",
      reason: "Erro de digitação na célula B2",
    });
    await grading.overrideLevelConcept(ctx, attemptId, {
      concept: "PD",
      reason: "Revisei de novo: todos corretos",
    });
    const r = await grading.getConceptHistory(forTenant(T), attemptId);
    expect(r.history).toEqual([
      {
        previousConcept: "ED",
        concept: "D",
        computedConcept: "ED",
        reason: "Erro de digitação na célula B2",
        adjustedBy: professor,
        adjustedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      },
      {
        previousConcept: "D",
        concept: "PD",
        computedConcept: "ED",
        reason: "Revisei de novo: todos corretos",
        adjustedBy: professor,
        adjustedAt: expect.any(String),
      },
    ]);
    expect(r.history[0]!.adjustedAt <= r.history[1]!.adjustedAt).toBe(true);
    expect(
      await prisma.auditLog.count({
        where: { action: "level_attempt.concept_overridden", entityId: attemptId },
      }),
    ).toBe(2);
  });

  it("sem ajustes → { history: [] }", async () => {
    const other = await prisma.levelAttempt.create({
      data: {
        tenantId: T,
        studentId: (await prisma.levelAttempt.findUniqueOrThrow({ where: { id: attemptId } }))
          .studentId,
        levelId: (await prisma.levelAttempt.findUniqueOrThrow({ where: { id: attemptId } }))
          .levelId,
        attemptNumber: 2,
      },
    });
    expect(await grading.getConceptHistory(forTenant(T), other.id)).toEqual({ history: [] });
  });

  it("tentativa de outra instituição → 404 NOT_FOUND", async () => {
    await expect(grading.getConceptHistory(forTenant(OTHER), attemptId)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});
