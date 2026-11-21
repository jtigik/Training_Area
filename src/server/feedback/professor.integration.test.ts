/** Professor edita resumo e listas separadamente; originais da IA imutáveis. npm run test:db. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.RUN_DB_TESTS === "1";
const T = "tenant-escola-demo";

describe.skipIf(!enabled)("feedback: edição do professor e visão do aluno", () => {
  let prisma: (typeof import("@/server/db"))["prisma"];
  let forTenant: (typeof import("@/server/tenant-db"))["forTenant"];
  let prof: typeof import("@/server/feedback/professor");
  let student: typeof import("@/server/feedback/student");
  let ctx: Parameters<(typeof import("@/server/feedback/professor"))["editFeedback"]>[0];
  let studentId: string;
  let feedbackId: string;
  let setId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db"));
    ({ forTenant } = await import("@/server/tenant-db"));
    prof = await import("@/server/feedback/professor");
    student = await import("@/server/feedback/student");
    const professorId = (
      await prisma.user.findUniqueOrThrow({ where: { email: "professor@escola-demo.local" } })
    ).id;
    studentId = (
      await prisma.user.findUniqueOrThrow({ where: { email: "aluno@escola-demo.local" } })
    ).id;
    ctx = { db: forTenant(T), tenantId: T, user: { id: professorId } } as typeof ctx;
    setId = (
      await prisma.exerciseSet.create({
        data: { tenantId: T, name: "IT feedback", difficulties: ["EASY"] },
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
        computedConcept: "D",
        concept: "D",
      },
    });
    feedbackId = (
      await prisma.feedback.create({
        data: {
          tenantId: T,
          studentId,
          levelAttemptId: attempt.id,
          generationStatus: "GENERATED",
          aiText: "Resumo da IA",
          aiStrengths: ["IA forte 1", "IA forte 2"],
          aiToReview: ["IA revisar"],
          metrics: {},
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.exerciseSet.deleteMany({ where: { id: setId } });
  });

  it("edita só a lista de pontos fortes; resumo e 'a revisar' seguem da IA", async () => {
    const v = await prof.editFeedback(ctx, feedbackId, { strengths: ["Usa SOMA com intervalos"] });
    expect(v.ai).toEqual({
      text: "Resumo da IA",
      strengths: ["IA forte 1", "IA forte 2"],
      toReview: ["IA revisar"],
    });
    expect(v.edited).toMatchObject({
      text: null,
      strengths: ["Usa SOMA com intervalos"],
      toReview: null,
    });
    expect(v.final).toEqual({
      text: "Resumo da IA",
      strengths: ["Usa SOMA com intervalos"],
      toReview: ["IA revisar"],
    });
  });

  it("edita resumo e 'a revisar' (vazia) e audita cada edição com before/after", async () => {
    await prof.editFeedback(ctx, feedbackId, { text: "Resumo do professor", toReview: [] });
    const logs = await prisma.auditLog.findMany({
      where: { action: "feedback.edited", entityId: feedbackId },
      orderBy: { createdAt: "asc" },
    });
    expect(logs).toHaveLength(2);
    expect(logs[1]!.data).toEqual({
      text: { from: null, to: "Resumo do professor" },
      toReview: { from: null, to: [] },
    });
  });

  it("originais da IA são imutáveis no banco (trigger)", async () => {
    await expect(
      prisma.feedback.update({ where: { id: feedbackId }, data: { aiText: "trocado" } }),
    ).rejects.toThrow();
  });

  it("aluno não vê DRAFT; após aprovar vê a versão editada; aprovado não edita mais", async () => {
    const sctx = { db: forTenant(T), user: { id: studentId } } as Parameters<
      typeof student.listApprovedFeedbackForStudent
    >[0];
    expect(
      await student.getApprovedFeedbackForStudent(
        sctx,
        (await prisma.feedback.findUniqueOrThrow({ where: { id: feedbackId } })).levelAttemptId,
      ),
    ).toBeNull();
    const approved = await prof.reviewFeedback(ctx, feedbackId, { action: "approve" });
    expect(approved.status).toBe("APPROVED");
    const [view] = await student.listApprovedFeedbackForStudent(sctx, {
      levelAttemptId: approved.levelAttemptId,
    });
    expect(view).toMatchObject({
      text: "Resumo do professor",
      strengths: ["Usa SOMA com intervalos"],
      toReview: [],
    });
    await expect(prof.editFeedback(ctx, feedbackId, { text: "x" })).rejects.toMatchObject({
      status: 409,
      code: "NOT_EDITABLE",
    });
    await expect(prof.reviewFeedback(ctx, feedbackId, { action: "approve" })).rejects.toMatchObject(
      { code: "ALREADY_REVIEWED" },
    );
    expect(
      await prisma.auditLog.count({ where: { action: "feedback.approved", entityId: feedbackId } }),
    ).toBe(1);
  });

  it("outra instituição → 404", async () => {
    const other = { ...ctx, db: forTenant("tenant-inexistente"), tenantId: "tenant-inexistente" };
    await expect(prof.getFeedbackForProfessor(other, feedbackId)).rejects.toMatchObject({
      status: 404,
    });
  });
});
