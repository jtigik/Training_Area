/**
 * Serviços da trilha do aluno (as rotas HTTP são do Backend 2): conjunto só
 * publicado, desbloqueio pelo conceito efetivo, cota por dificuldade e sorteio
 * congelado. Postgres real: npm run test:db.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.RUN_DB_TESTS === "1";
const T = "tenant-escola-demo";

describe.skipIf(!enabled)("startLevelAttempt / getSetProgress", () => {
  let prisma: (typeof import("@/server/db"))["prisma"];
  let forTenant: (typeof import("@/server/tenant-db"))["forTenant"];
  let svc: typeof import("@/server/levels/start");
  let draws: typeof import("@/server/content/draws");
  let sets: typeof import("@/server/content/sets");
  let studentId: string;
  let ctx: Parameters<(typeof import("@/server/levels/start"))["startLevelAttempt"]>[0];
  let setId: string;
  let fundId: string;
  let profId: string;
  const created: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db"));
    ({ forTenant } = await import("@/server/tenant-db"));
    svc = await import("@/server/levels/start");
    draws = await import("@/server/content/draws");
    sets = await import("@/server/content/sets");
    studentId = (
      await prisma.user.findUniqueOrThrow({ where: { email: "aluno@escola-demo.local" } })
    ).id;
    ctx = { db: forTenant(T), tenantId: T, user: { id: studentId } } as typeof ctx;
    const set = await prisma.exerciseSet.create({
      data: { tenantId: T, name: "IT trilha", difficulties: ["VERY_EASY", "EASY", "MEDIUM"] },
    });
    setId = set.id;
    created.push(setId);
    fundId = (
      await prisma.level.create({ data: { tenantId: T, setId, knowledgeLevel: "FUNDAMENTAL" } })
    ).id;
    profId = (
      await prisma.level.create({ data: { tenantId: T, setId, knowledgeLevel: "PROFESSIONAL" } })
    ).id;
    await prisma.exerciseQuota.createMany({
      data: [
        {
          tenantId: T,
          levelId: fundId,
          difficulty: "VERY_EASY",
          scopeKey: "default|VERY_EASY",
          quantity: 2,
        },
        { tenantId: T, levelId: fundId, difficulty: "EASY", scopeKey: "default|EASY", quantity: 1 },
        {
          tenantId: T,
          levelId: fundId,
          difficulty: "MEDIUM",
          scopeKey: "default|MEDIUM",
          quantity: 0 + 5,
        },
        {
          tenantId: T,
          levelId: fundId,
          difficulty: "EASY",
          studentId,
          scopeKey: `student:${studentId}|EASY`,
          quantity: 0 + 1,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.levelAttempt.deleteMany({ where: { levelId: { in: [fundId, profId] } } });
    await prisma.exerciseSet.deleteMany({ where: { id: { in: created } } });
  });

  it("rascunho: progresso e início dão 404 NOT_FOUND", async () => {
    await expect(svc.getSetProgress(ctx.db, studentId, setId)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    await expect(svc.startLevelAttempt(ctx, fundId)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("publicado: nível bloqueado → 409 LEVEL_LOCKED", async () => {
    await sets.publishSet(ctx.db, T, setId);
    await expect(svc.startLevelAttempt(ctx, profId)).rejects.toMatchObject({
      status: 409,
      code: "LEVEL_LOCKED",
    });
  });

  it("inicia com cota por dificuldade, registra falta do pool e congela o sorteio", async () => {
    const r = await svc.startLevelAttempt(ctx, fundId);
    expect(r.quota.map((q) => [q.difficulty, q.quantity, q.source])).toEqual([
      ["VERY_EASY", 2, "default"],
      ["EASY", 1, "student"],
      ["MEDIUM", 5, "default"],
    ]);
    // pool global do seed: 2 VERY_EASY? (o que houver) — a soma sorteada vira requiredCount
    expect(r.levelAttempt.requiredCount).toBe(r.exercises.length);
    expect(r.shortfalls.some((s) => s.difficulty === "MEDIUM")).toBe(true);
    expect(r.exercises[0]).not.toHaveProperty("expectedResult");
    const frozen = await draws.listAttemptExercises(ctx.db, r.levelAttempt.id);
    expect(frozen.map((e) => e.ref)).toEqual(r.exercises.map((e) => e.ref));
    await expect(svc.startLevelAttempt(ctx, fundId)).rejects.toMatchObject({
      code: "LEVEL_IN_PROGRESS",
    });
  });

  it("conceito efetivo: ajuste D (calculado ED) libera o próximo; nova tentativa sem ajuste", async () => {
    const attempt = await prisma.levelAttempt.findFirstOrThrow({
      where: { levelId: fundId, status: "IN_PROGRESS" },
    });
    await prisma.levelAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        gradedAt: new Date(),
        computedConcept: "ED",
        concept: "ED",
      },
    });
    // ED → pode refazer; Profissional continua bloqueado
    let progress = await svc.getSetProgress(ctx.db, studentId, setId);
    expect(progress[0]).toMatchObject({ bestConcept: "ED", passed: false });
    expect(progress[1]!.unlocked).toBe(false);

    await prisma.levelAttempt.update({
      where: { id: attempt.id },
      data: {
        concept: "D",
        overriddenById: studentId,
        overrideReason: "ajuste de teste integrado",
        overriddenAt: new Date(),
      },
    });
    progress = await svc.getSetProgress(ctx.db, studentId, setId);
    expect(progress[0]).toMatchObject({ lastConcept: "D", bestConcept: "D", passed: true });
    expect(progress[0]!.start).toEqual({ allowed: false, reason: "ALREADY_PASSED" });
    expect(progress[1]!.unlocked).toBe(true);
    await expect(svc.startLevelAttempt(ctx, fundId)).rejects.toMatchObject({
      code: "LEVEL_ALREADY_PASSED",
    });
    // Profissional: sem cota cadastrada → padrão por dificuldade; nova tentativa sem ajuste
    const prof = await svc.startLevelAttempt(ctx, profId);
    expect(prof.quota.every((q) => q.source === "fallback")).toBe(true);
    expect(prof.levelAttempt).toMatchObject({
      attemptNumber: 1,
      concept: null,
      overriddenAt: null,
      overrideReason: null,
    });
  });
});
