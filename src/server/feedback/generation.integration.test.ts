/** Regeração do feedback: histórico, só em DRAFT, edição preservada. npm run test:db. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.RUN_DB_TESTS === "1";
const T = "tenant-escola-demo";

describe.skipIf(!enabled)("recordFeedbackGeneration", () => {
  let prisma: (typeof import("@/server/db"))["prisma"];
  let forTenant: (typeof import("@/server/tenant-db"))["forTenant"];
  let gen: typeof import("@/server/feedback/generation");
  let prof: typeof import("@/server/feedback/professor");
  let setId: string;
  let feedbackId: string;
  let professorId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db"));
    ({ forTenant } = await import("@/server/tenant-db"));
    gen = await import("@/server/feedback/generation");
    prof = await import("@/server/feedback/professor");
    professorId = (
      await prisma.user.findUniqueOrThrow({ where: { email: "professor@escola-demo.local" } })
    ).id;
    const studentId = (
      await prisma.user.findUniqueOrThrow({ where: { email: "aluno@escola-demo.local" } })
    ).id;
    setId = (
      await prisma.exerciseSet.create({
        data: { tenantId: T, name: "IT geração", difficulties: ["EASY"] },
      })
    ).id;
    const level = await prisma.level.create({
      data: { tenantId: T, setId, knowledgeLevel: "FUNDAMENTAL" },
    });
    const attempt = await prisma.levelAttempt.create({
      data: {
        tenantId: T,
        studentId,
        levelId: level.id,
        attemptNumber: 1,
        status: "COMPLETED",
        completedAt: new Date(),
        gradedAt: new Date(),
        computedConcept: "ED",
        concept: "ED",
      },
    });
    feedbackId = (
      await prisma.feedback.create({
        data: { tenantId: T, studentId, levelAttemptId: attempt.id, metrics: {} },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.exerciseSet.deleteMany({ where: { id: setId } });
  });

  const db = () => forTenant(T);
  const ok = (n: number) => ({
    status: "GENERATED" as const,
    aiText: `Resumo IA ${n}`,
    strengths: [`forte ${n}`],
    toReview: [`revisar ${n}`],
    aiModel: "mock",
  });

  it("1ª geração preenche ai*; regenerar em DRAFT acrescenta histórico e espelha a última", async () => {
    const first = await gen.recordFeedbackGeneration(db(), T, feedbackId, ok(1));
    expect(first.feedback).toMatchObject({ generationCount: 1, aiText: "Resumo IA 1" });
    // professor edita só a lista de pontos fortes
    const ctx = { db: db(), tenantId: T, user: { id: professorId } } as Parameters<
      typeof prof.editFeedback
    >[0];
    await prof.editFeedback(ctx, feedbackId, { strengths: ["editado pelo professor"] });

    const second = await gen.recordFeedbackGeneration(db(), T, feedbackId, ok(2));
    expect(second.feedback).toMatchObject({
      generationCount: 2,
      generationStatus: "GENERATED",
      aiText: "Resumo IA 2",
      aiStrengths: ["forte 2"],
      // edição do professor intacta
      editedStrengths: ["editado pelo professor"],
      editedText: null,
    });
    const history = await gen.listFeedbackGenerations(db(), feedbackId);
    expect(history.map((h) => [h.sequence, h.status, h.aiText])).toEqual([
      [1, "GENERATED", "Resumo IA 1"],
      [2, "GENERATED", "Resumo IA 2"],
    ]);
  });

  it("falha na regeração fica no histórico e preserva a última geração boa", async () => {
    const failed = await gen.recordFeedbackGeneration(db(), T, feedbackId, {
      status: "FAILED",
      error: "timeout do provedor",
    });
    expect(failed.feedback).toMatchObject({
      generationCount: 3,
      generationStatus: "GENERATED",
      generationError: "timeout do provedor",
      aiText: "Resumo IA 2",
    });
    expect(failed.generation).toMatchObject({ sequence: 3, status: "FAILED", aiText: null });
  });

  it("banco: ai* não mudam fora de uma nova geração; histórico é append-only", async () => {
    await expect(
      prisma.feedback.update({ where: { id: feedbackId }, data: { aiText: "à mão" } }),
    ).rejects.toThrow();
    const row = await prisma.feedbackGeneration.findFirstOrThrow({ where: { feedbackId } });
    await expect(
      prisma.feedbackGeneration.update({ where: { id: row.id }, data: { aiText: "x" } }),
    ).rejects.toThrow();
  });

  it("após APPROVED → 409 NOT_REGENERABLE (serviço e banco); auditoria registrada", async () => {
    const ctx = { db: db(), tenantId: T, user: { id: professorId } } as Parameters<
      typeof prof.reviewFeedback
    >[0];
    await prof.reviewFeedback(ctx, feedbackId, { action: "approve" });
    await expect(gen.recordFeedbackGeneration(db(), T, feedbackId, ok(4))).rejects.toMatchObject({
      status: 409,
      code: "NOT_REGENERABLE",
    });
    await expect(
      prisma.feedback.update({
        where: { id: feedbackId },
        data: { generationCount: 4, aiText: "burlando" },
      }),
    ).rejects.toThrow();
    expect(
      await prisma.auditLog.count({
        where: { action: "feedback.generated", entityId: feedbackId },
      }),
    ).toBe(3);
  });

  it("outra instituição → 404", async () => {
    await expect(
      gen.recordFeedbackGeneration(
        forTenant("tenant-inexistente"),
        "tenant-inexistente",
        feedbackId,
        ok(9),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
