/**
 * Conjunto rascunho (pool vivo) × publicado (snapshot congelado) e sorteio
 * persistido. Postgres real: npm run test:db.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.RUN_DB_TESTS === "1";
const T = "tenant-escola-demo";

describe.skipIf(!enabled)("publishSet / listSetExercises / sorteio", () => {
  let prisma: (typeof import("@/server/db"))["prisma"];
  let forTenant: (typeof import("@/server/tenant-db"))["forTenant"];
  let sets: typeof import("@/server/content/sets");
  let draws: typeof import("@/server/content/draws");
  let setId: string;
  let levelId: string;
  let studentId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db"));
    ({ forTenant } = await import("@/server/tenant-db"));
    sets = await import("@/server/content/sets");
    draws = await import("@/server/content/draws");
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
  });

  afterAll(async () => {
    await prisma.levelAttempt.deleteMany({ where: { levelId } });
    await prisma.exerciseSet.deleteMany({ where: { id: setId } });
  });

  it("rascunho lista o pool vivo; publicado lista o snapshot congelado", async () => {
    const db = forTenant(T);
    const draft = await sets.listSetExercises(db, setId);
    expect(draft.source).toBe("pool");
    const poolItems = draft.levels[0]!.exercises;
    expect(poolItems.length).toBeGreaterThan(0);
    expect(poolItems.every((e) => e.ref.type === "exercise")).toBe(true);

    const result = await sets.publishSet(db, T, setId);
    expect(result.levels[0]!.count).toBe(poolItems.length);
    await expect(sets.publishSet(db, T, setId)).rejects.toMatchObject({
      code: "ALREADY_PUBLISHED",
    });

    // Edição no banco global NÃO afeta o conjunto publicado.
    const source = poolItems[0]!;
    const original = await prisma.exercise.findUniqueOrThrow({ where: { id: source.ref.id } });
    await prisma.exercise.update({
      where: { id: original.id },
      data: { title: "ALTERADO DEPOIS" },
    });
    try {
      const published = await sets.listSetExercises(db, setId);
      expect(published.source).toBe("snapshot");
      const items = published.levels[0]!.exercises;
      expect(items.every((e) => e.ref.type === "setExercise")).toBe(true);
      expect(items.find((e) => e.sourceExerciseId === original.id)?.title).toBe(original.title);
    } finally {
      await prisma.exercise.update({ where: { id: original.id }, data: { title: original.title } });
    }
  });

  it("sorteio é congelado em LevelAttemptExercise e relido na mesma ordem", async () => {
    const db = forTenant(T);
    const attempt = await prisma.levelAttempt.create({
      data: { tenantId: T, studentId, levelId, attemptNumber: 1 },
    });
    const drawn = await db.$transaction((tx) =>
      draws.drawForLevelAttempt(tx, {
        tenantId: T,
        levelAttemptId: attempt.id,
        levelId,
        knowledgeLevel: "FUNDAMENTAL",
        setStatus: "PUBLISHED",
        difficulties: ["VERY_EASY", "EASY", "MEDIUM"],
        quantity: 2,
      }),
    );
    expect(drawn).toHaveLength(2);
    const reread = await draws.listAttemptExercises(db, attempt.id);
    expect(reread.map((e) => e.ref)).toEqual(drawn.map((e) => e.ref));
    expect(reread.map((e) => e.position)).toEqual([0, 1]);
  });
});
