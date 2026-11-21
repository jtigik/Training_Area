/**
 * Pool vinculado (SetPoolExercise), publicação versionada e sorteio persistido.
 * Postgres real: npm run test:db.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.RUN_DB_TESTS === "1";
const T = "tenant-escola-demo";
const OTHER = "tenant-it-pool-outra";

describe.skipIf(!enabled)("pool vinculado / publishSet versionado / sorteio", () => {
  let prisma: (typeof import("@/server/db"))["prisma"];
  let forTenant: (typeof import("@/server/tenant-db"))["forTenant"];
  let sets: typeof import("@/server/content/sets");
  let draws: typeof import("@/server/content/draws");
  let links: typeof import("@/server/content/pool-links");
  let setId: string;
  let levelId: string;
  let studentId: string;
  let otherExerciseId: string;
  const quotas = [
    { difficulty: "VERY_EASY" as const, quantity: 1 },
    { difficulty: "EASY" as const, quantity: 1 },
    { difficulty: "MEDIUM" as const, quantity: 1 },
  ];

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db"));
    ({ forTenant } = await import("@/server/tenant-db"));
    sets = await import("@/server/content/sets");
    draws = await import("@/server/content/draws");
    links = await import("@/server/content/pool-links");
    const set = await prisma.exerciseSet.create({
      data: { tenantId: T, name: "IT conjunto", difficulties: ["VERY_EASY", "EASY", "MEDIUM"] },
    });
    setId = set.id;
    levelId = (
      await prisma.level.create({ data: { tenantId: T, setId, knowledgeLevel: "FUNDAMENTAL" } })
    ).id;
    studentId = (
      await prisma.user.findUniqueOrThrow({ where: { email: "aluno@escola-demo.local" } })
    ).id;
    await prisma.tenant.create({
      data: { id: OTHER, name: "Outra IT pool", slug: "outra-it-pool" },
    });
    otherExerciseId = (
      await prisma.exercise.create({
        data: {
          tenantId: OTHER,
          title: "Exercício de outra instituição",
          statement: "x",
          initialSheet: { cells: {} },
          expectedResult: [{ cell: "A1", value: 1 }],
          level: "FUNDAMENTAL",
          difficulty: "EASY",
          status: "PUBLISHED",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.levelAttempt.deleteMany({ where: { levelId } });
    await prisma.exerciseSet.deleteMany({ where: { id: setId } });
    await prisma.tenant.deleteMany({ where: { id: OTHER } });
  });

  const fundamentalGlobals = () =>
    prisma.exercise.findMany({
      where: { tenantId: null, level: "FUNDAMENTAL", status: "PUBLISHED" },
      orderBy: { difficulty: "asc" },
    });

  it("rascunho sem vínculos tem pool vazio; publicar → 409 EMPTY_POOL", async () => {
    const db = forTenant(T);
    const draft = await sets.listSetExercises(db, setId);
    expect(draft.levels[0]!.exercises).toEqual([]);
    await expect(sets.publishSet(db, T, setId)).rejects.toMatchObject({ code: "EMPTY_POOL" });
  });

  it("vincular/desvincular/listar; exercício de outra instituição → 404; idempotente", async () => {
    const db = forTenant(T);
    const globals = await fundamentalGlobals();
    const proLevel = await prisma.exercise.findFirstOrThrow({
      where: { tenantId: null, level: "PROFESSIONAL" },
    });
    expect(
      await links.linkExercisesToSet(db, T, setId, [...globals.map((e) => e.id), proLevel.id]),
    ).toEqual({ linked: globals.length + 1 });
    expect(await links.linkExercisesToSet(db, T, setId, [globals[0]!.id])).toEqual({ linked: 0 });
    await expect(links.linkExercisesToSet(db, T, setId, [otherExerciseId])).rejects.toMatchObject({
      status: 404,
      code: "EXERCISE_NOT_FOUND",
    });
    expect((await links.listSetPoolLinks(db, setId)).map((e) => e.id)).toContain(proLevel.id);
    // vinculado de outro nível não entra no pool do Fundamental
    const draft = await sets.listSetExercises(db, setId);
    expect(draft.source).toBe("pool");
    expect(draft.levels[0]!.exercises.map((e) => e.ref.id).sort()).toEqual(
      globals.map((e) => e.id).sort(),
    );
    expect(await links.unlinkExercisesFromSet(db, setId, [proLevel.id])).toEqual({ unlinked: 1 });
  });

  it("publica v1 só com os vinculados; edição posterior não afeta; republicar publicado → 409", async () => {
    const db = forTenant(T);
    const globals = await fundamentalGlobals();
    const result = await sets.publishSet(db, T, setId);
    expect(result).toMatchObject({ version: 1, levels: [{ levelId, count: globals.length }] });
    await expect(sets.publishSet(db, T, setId)).rejects.toMatchObject({
      status: 409,
      code: "ALREADY_PUBLISHED",
    });

    const original = globals[0]!;
    await prisma.exercise.update({ where: { id: original.id }, data: { title: "ALTERADO" } });
    try {
      const published = await sets.listSetExercises(db, setId);
      expect(published.source).toBe("snapshot");
      expect(published.set.publishedVersion).toBe(1);
      const items = published.levels[0]!.exercises;
      expect(items.every((e) => e.ref.type === "setExercise")).toBe(true);
      expect(items.find((e) => e.sourceExerciseId === original.id)?.title).toBe(original.title);
    } finally {
      await prisma.exercise.update({ where: { id: original.id }, data: { title: original.title } });
    }
  });

  it("despublicar e republicar cria v2 sem apagar a v1; rodada em curso mantém a sua", async () => {
    const db = forTenant(T);
    const attemptV1 = await prisma.levelAttempt.create({
      data: { tenantId: T, studentId, levelId, attemptNumber: 1 },
    });
    const drawnV1 = await db.$transaction((tx) =>
      draws.drawForLevelAttempt(tx, {
        tenantId: T,
        levelAttemptId: attemptV1.id,
        levelId,
        setId,
        knowledgeLevel: "FUNDAMENTAL",
        setStatus: "PUBLISHED",
        setVersion: 1,
        quotas,
      }),
    );
    expect(drawnV1.drawn.length).toBeGreaterThan(0);

    expect(await sets.unpublishSet(db, setId)).toMatchObject({
      status: "DRAFT",
      publishedVersion: 1,
    });
    await expect(sets.unpublishSet(db, setId)).rejects.toMatchObject({ code: "NOT_PUBLISHED" });
    // tira o MEDIUM do pool antes de republicar
    const medium = (await fundamentalGlobals()).filter((e) => e.difficulty === "MEDIUM");
    await links.unlinkExercisesFromSet(
      db,
      setId,
      medium.map((e) => e.id),
    );
    const v2 = await sets.publishSet(db, T, setId);
    expect(v2.version).toBe(2);

    const byVersion = await prisma.setExercise.groupBy({
      by: ["version"],
      where: { setId },
      _count: true,
      orderBy: { version: "asc" },
    });
    expect(byVersion.map((v) => v.version)).toEqual([1, 2]);
    // rodada antiga relê a v1 intacta
    const reread = await draws.listAttemptExercises(db, attemptV1.id);
    expect(reread.map((e) => e.ref)).toEqual(drawnV1.drawn.map((e) => e.ref));
    const v1Ids = new Set(
      (await prisma.setExercise.findMany({ where: { setId, version: 1 } })).map((r) => r.id),
    );
    expect(reread.every((e) => v1Ids.has(e.ref.id))).toBe(true);

    // novo sorteio usa a v2 (sem MEDIUM) e sinaliza a falta
    await prisma.levelAttempt.update({
      where: { id: attemptV1.id },
      data: { status: "ABANDONED" },
    });
    const attemptV2 = await prisma.levelAttempt.create({
      data: { tenantId: T, studentId, levelId, attemptNumber: 2 },
    });
    const drawnV2 = await db.$transaction((tx) =>
      draws.drawForLevelAttempt(tx, {
        tenantId: T,
        levelAttemptId: attemptV2.id,
        levelId,
        setId,
        knowledgeLevel: "FUNDAMENTAL",
        setStatus: "PUBLISHED",
        setVersion: 2,
        quotas,
      }),
    );
    expect(drawnV2.drawn.every((e) => !v1Ids.has(e.ref.id))).toBe(true);
    expect(drawnV2.drawn.some((e) => e.difficulty === "MEDIUM")).toBe(false);
    expect(drawnV2.shortfalls).toEqual([{ difficulty: "MEDIUM", required: 1, available: 0 }]);
    const listed = await sets.listSetExercises(db, setId);
    expect(listed.set.publishedVersion).toBe(2);
    expect(listed.levels[0]!.exercises.every((e) => !v1Ids.has(e.ref.id))).toBe(true);
  });
});
