// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DomainError, type Actor } from "@/server/domain";

import {
  ExerciseService,
  InMemoryAttemptRepository,
  InMemoryExerciseRepository,
  InMemoryExerciseSetRepository,
  ResultsService,
  type CreateExerciseInput,
} from "./index";

const T1 = "tenant-1";
const T2 = "tenant-2";
const teacher: Actor = { userId: "prof", role: "TEACHER", tenantId: T1 };
const alice: Actor = { userId: "alice", role: "STUDENT", tenantId: T1 };
const bob: Actor = { userId: "bob", role: "STUDENT", tenantId: T1 };
const otherTeacher: Actor = { userId: "prof2", role: "TEACHER", tenantId: T2 };

const baseInput = (over: Partial<CreateExerciseInput> = {}): CreateExerciseInput => ({
  setId: "set-1",
  title: "Soma",
  statement: "Some A1:A3 em A4",
  hint: "Use SOMA",
  level: "FUNDAMENTAL",
  difficulty: "EASY",
  content: {
    sheet: { A1: 10, A2: 20, A3: 30 },
    targets: [{ cell: "A4", expected: { formula: "=SUM(A1:A3)" } }],
  },
  ...over,
});

let seq = 0;
let clock = new Date("2026-11-21T10:00:00Z");
let sets: InMemoryExerciseSetRepository;
let exercises: InMemoryExerciseRepository;
let attempts: InMemoryAttemptRepository;
let service: ExerciseService;
let results: ResultsService;
const onDivergence = vi.fn();

beforeEach(() => {
  seq = 0;
  clock = new Date("2026-11-21T10:00:00Z");
  const id = () => `id-${String(++seq).padStart(3, "0")}`;
  sets = new InMemoryExerciseSetRepository([
    {
      id: "set-1",
      tenantId: T1,
      name: "Trilha",
      levels: ["FUNDAMENTAL", "PROFESSIONAL"],
      difficulties: ["EASY", "MEDIUM"],
      status: "PUBLISHED",
    },
    {
      id: "set-x",
      tenantId: T2,
      name: "Outra",
      levels: ["FUNDAMENTAL"],
      difficulties: ["EASY"],
      status: "PUBLISHED",
    },
  ]);
  exercises = new InMemoryExerciseRepository(id, () => clock);
  attempts = new InMemoryAttemptRepository(id);
  onDivergence.mockReset();
  service = new ExerciseService({
    sets,
    exercises,
    attempts,
    clock: { now: () => clock },
    onDivergence,
  });
  results = new ResultsService({ attempts, exercises });
});

async function published(over: Partial<CreateExerciseInput> = {}) {
  const e = await service.createExercise(teacher, T1, baseInput(over));
  return service.updateExercise(teacher, T1, e.id, { status: "PUBLISHED" });
}

describe("CRUD do professor", () => {
  it("cria em rascunho, valida e atualiza", async () => {
    const e = await service.createExercise(teacher, T1, baseInput());
    expect(e).toMatchObject({ status: "DRAFT", tenantId: T1, authorId: "prof", hint: "Use SOMA" });
    const u = await service.updateExercise(teacher, T1, e.id, { title: "Soma simples" });
    expect(u.title).toBe("Soma simples");
    expect((await service.listExercises(teacher, T1, { setId: "set-1" })).length).toBe(1);
    expect((await service.archiveExercise(teacher, T1, e.id)).status).toBe("ARCHIVED");
  });

  it("recusa nível fora do conjunto, Dashboard e gabarito inválido", async () => {
    await expect(
      service.createExercise(teacher, T1, baseInput({ level: "ADVANCED" })),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      service.createExercise(teacher, T1, baseInput({ level: "DASHBOARD" as never })),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      service.createExercise(
        teacher,
        T1,
        baseInput({
          content: { sheet: {}, targets: [{ cell: "A1", expected: { formula: "=1/0" } }] },
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      service.createExercise(teacher, T1, baseInput({ title: "" })),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("isola tenants e exige papel de professor", async () => {
    const e = await service.createExercise(teacher, T1, baseInput());
    await expect(service.getExercise(otherTeacher, T1, e.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(service.getExercise(otherTeacher, T2, e.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.createExercise(otherTeacher, T2, baseInput())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.createExercise(alice, T1, baseInput())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("sorteio por nível e dificuldade", () => {
  beforeEach(async () => {
    for (let i = 0; i < 6; i += 1)
      await published({ title: `F${i}`, difficulty: i % 2 ? "EASY" : "MEDIUM" });
    await published({ title: "P", level: "PROFESSIONAL" });
    await service.createExercise(teacher, T1, baseInput({ title: "rascunho" }));
  });

  it("respeita a quantidade, só publicados e sem gabarito", async () => {
    const r = await service.drawExercises(alice, T1, {
      studentId: "alice",
      setId: "set-1",
      level: "FUNDAMENTAL",
      quantity: 4,
    });
    expect(r.exercises).toHaveLength(4);
    expect(r.shortfall).toBe(0);
    expect(r.exercises.every((e) => e.level === "FUNDAMENTAL" && e.title !== "rascunho")).toBe(
      true,
    );
    expect(JSON.stringify(r.exercises)).not.toContain("SUM(A1:A3)");
    expect(r.exercises[0]?.targetCells).toEqual(["A4"]);
  });

  it("é estável por aluno, muda entre alunos/ciclos e filtra dificuldade", async () => {
    const q = { setId: "set-1", level: "FUNDAMENTAL" as const, quantity: 3 };
    const a1 = await service.drawExercises(alice, T1, { ...q, studentId: "alice" });
    const a2 = await service.drawExercises(alice, T1, { ...q, studentId: "alice" });
    expect(a2.exercises.map((e) => e.id)).toEqual(a1.exercises.map((e) => e.id));
    const ids = (r: typeof a1) => r.exercises.map((e) => e.id).join();
    const variants = new Set([ids(a1)]);
    for (let c = 2; c <= 6; c += 1)
      variants.add(
        ids(await service.drawExercises(alice, T1, { ...q, studentId: "alice", levelCycle: c })),
      );
    expect(variants.size).toBeGreaterThan(1);
    const easy = await service.drawExercises(bob, T1, {
      ...q,
      studentId: "bob",
      difficulty: "EASY",
      quantity: 10,
    });
    expect(easy.exercises.every((e) => e.difficulty === "EASY")).toBe(true);
    expect(easy.shortfall).toBe(7);
  });

  it("valida quantidade e acesso", async () => {
    const q = { setId: "set-1", level: "FUNDAMENTAL" as const, studentId: "alice" };
    await expect(service.drawExercises(alice, T1, { ...q, quantity: 0 })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(service.drawExercises(bob, T1, { ...q, quantity: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("tentativas e resultados", () => {
  it("corrige no servidor, numera tentativas, mostra dica e registra divergência", async () => {
    const e = await published();
    const wrong = await service.registerAttempt(alice, T1, {
      exerciseId: e.id,
      submission: { A4: "=A1+A2" },
      clientIsCorrect: true,
    });
    expect(wrong).toMatchObject({ correct: false, attemptNumber: 1, hint: "Use SOMA" });
    expect(wrong.cells.A4).not.toHaveProperty("expectedValue");
    expect(onDivergence).toHaveBeenCalledTimes(1);

    const right = await service.registerAttempt(alice, T1, {
      exerciseId: e.id,
      submission: { A4: "=SOMA(A1:A3)" },
    });
    expect(right).toMatchObject({ correct: true, attemptNumber: 2, hint: null });
    expect(attempts.items[1]?.grading.cells.A4?.analysis?.uniqueFunctions).toEqual(["SUM"]);

    await expect(
      service.registerAttempt(teacher, T1, { exerciseId: e.id, submission: {} }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const draft = await service.createExercise(teacher, T1, baseInput());
    await expect(
      service.registerAttempt(alice, T1, { exerciseId: draft.id, submission: {} }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("agrega resultados da turma com filtros e alunos sem tentativas", async () => {
    const e1 = await published({ title: "E1" });
    const e2 = await published({ title: "E2", difficulty: "MEDIUM" });
    await service.registerAttempt(alice, T1, { exerciseId: e1.id, submission: { A4: "=A1" } });
    await service.registerAttempt(alice, T1, {
      exerciseId: e1.id,
      submission: { A4: "=SUM(A1:A3)" },
    });
    clock = new Date("2026-11-22T10:00:00Z");
    await service.registerAttempt(alice, T1, { exerciseId: e2.id, submission: { A4: "=A1" } });

    const r = await results.getClassResults(teacher, T1, {
      setId: "set-1",
      studentIds: ["alice", "carol"],
      requiredCountByLevel: { FUNDAMENTAL: 2 },
    });
    expect(r.rows[0]?.levels.FUNDAMENTAL).toMatchObject({
      status: "COMPLETED",
      exercisesAttempted: 2,
      exercisesCorrect: 1,
      attempts: 3,
      accuracyPercent: 50,
    });
    expect(r.rows[1]?.levels.FUNDAMENTAL.status).toBe("NOT_STARTED");
    expect(r.rows[0]?.levels).not.toHaveProperty("DASHBOARD");

    const filtered = await results.getClassResults(teacher, T1, {
      setId: "set-1",
      difficulty: "EASY",
      to: new Date("2026-11-22T00:00:00Z"),
    });
    expect(filtered.totals).toMatchObject({ students: 1, attempts: 2, accuracyPercent: 100 });
    const empty = await results.getClassResults(teacher, T1, {
      setId: "set-1",
      from: new Date("2030-01-01"),
    });
    expect(empty.rows).toEqual([]);

    const detail = await results.getStudentDetail(teacher, T1, "alice");
    expect(detail).toHaveLength(3);
    expect(detail[0]?.exerciseTitle).toBe("E2");
    expect(detail[2]?.submission).toEqual({ A4: "=A1" });
    await expect(results.getStudentDetail(bob, T1, "alice")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      results.getClassResults(otherTeacher, T1, { setId: "set-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
