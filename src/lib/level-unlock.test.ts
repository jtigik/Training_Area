import { describe, expect, it } from "vitest";

import { bestConcept, effectiveConcept, type LevelAttemptSummary } from "./grading";
import { computeLevelUnlocks } from "./level-unlock";

const done = (attemptNumber: number, concept: LevelAttemptSummary["concept"]) => ({
  attemptNumber,
  status: "COMPLETED" as const,
  concept,
});
const L = (knowledgeLevel: string, attempts: LevelAttemptSummary[] = []) => ({
  levelId: `id-${knowledgeLevel}`,
  knowledgeLevel: knowledgeLevel as "FUNDAMENTAL",
  attempts,
});
const unlocked = (levels: ReturnType<typeof computeLevelUnlocks>) =>
  Object.fromEntries(levels.map((l) => [l.knowledgeLevel, l.unlocked]));

describe("computeLevelUnlocks", () => {
  it("primeiro nível existente começa desbloqueado; os outros bloqueados", () => {
    const r = computeLevelUnlocks([L("ADVANCED"), L("FUNDAMENTAL"), L("PROFESSIONAL")]);
    expect(r.map((l) => l.knowledgeLevel)).toEqual(["FUNDAMENTAL", "PROFESSIONAL", "ADVANCED"]);
    expect(unlocked(r)).toEqual({ FUNDAMENTAL: true, PROFESSIONAL: false, ADVANCED: false });
    expect(r[0]!.start).toEqual({ allowed: true, attemptNumber: 1 });
    expect(r[1]!.start).toEqual({ allowed: false, reason: "LOCKED" });
    expect(r[1]!.requires).toBe("FUNDAMENTAL");
  });

  it("conjunto sem Fundamental: Profissional é o primeiro e já abre", () => {
    expect(unlocked(computeLevelUnlocks([L("PROFESSIONAL"), L("ADVANCED")]))).toEqual({
      PROFESSIONAL: true,
      ADVANCED: false,
    });
  });

  it("D ou PD no anterior libera o próximo; ND/ED permitem refazer, sem liberar", () => {
    for (const c of ["D", "PD"] as const) {
      expect(
        unlocked(computeLevelUnlocks([L("FUNDAMENTAL", [done(1, c)]), L("PROFESSIONAL")])),
      ).toMatchObject({ PROFESSIONAL: true });
    }
    const r = computeLevelUnlocks([L("FUNDAMENTAL", [done(1, "ED")]), L("PROFESSIONAL")]);
    expect(unlocked(r)).toEqual({ FUNDAMENTAL: true, PROFESSIONAL: false });
    expect(r[0]!.start).toEqual({ allowed: true, attemptNumber: 2 });
  });

  it("vale o conceito final da ÚLTIMA tentativa concluída (inclui ajuste do professor)", () => {
    // ND, depois D → libera
    expect(
      unlocked(
        computeLevelUnlocks([L("FUNDAMENTAL", [done(1, "ND"), done(2, "D")]), L("ADVANCED")]),
      ),
    ).toMatchObject({ ADVANCED: true });
    // professor ajustou a última para ED → volta a bloquear e permite refazer
    const r = computeLevelUnlocks([L("FUNDAMENTAL", [done(1, "ED")]), L("PROFESSIONAL")]);
    expect(r[1]!.unlocked).toBe(false);
  });

  it("pula níveis ausentes e ignora DASHBOARD", () => {
    const r = computeLevelUnlocks([
      L("FUNDAMENTAL", [done(1, "PD")]),
      L("DASHBOARD"),
      L("ADVANCED"),
    ]);
    expect(r.map((l) => l.knowledgeLevel)).toEqual(["FUNDAMENTAL", "ADVANCED"]);
    expect(r[1]!.unlocked).toBe(true);
    expect(r[1]!.requires).toBe("FUNDAMENTAL");
  });

  it("tentativa em andamento ou sem nota não libera o próximo", () => {
    const r = computeLevelUnlocks([
      L("FUNDAMENTAL", [{ attemptNumber: 1, status: "IN_PROGRESS", concept: null }]),
      L("PROFESSIONAL"),
    ]);
    expect(r[0]!.start).toEqual({ allowed: false, reason: "IN_PROGRESS" });
    expect(r[1]!.unlocked).toBe(false);
  });

  it("nível já aprovado não abre nova tentativa", () => {
    const r = computeLevelUnlocks([L("FUNDAMENTAL", [done(1, "PD")])]);
    expect(r[0]!.start).toEqual({ allowed: false, reason: "ALREADY_PASSED" });
  });
});

describe("conceito efetivo (ajuste > calculado)", () => {
  const graded = (
    attemptNumber: number,
    computedConcept: LevelAttemptSummary["concept"],
    concept: LevelAttemptSummary["concept"],
  ) => ({ attemptNumber, status: "COMPLETED" as const, computedConcept, concept });

  it("ajuste para D libera o próximo e impede refazer, mesmo com calculado ED", () => {
    const r = computeLevelUnlocks([L("FUNDAMENTAL", [graded(1, "ED", "D")]), L("PROFESSIONAL")]);
    expect(r[0]).toMatchObject({ lastConcept: "D", bestConcept: "D", passed: true });
    expect(r[0]!.start).toEqual({ allowed: false, reason: "ALREADY_PASSED" });
    expect(r[1]!.unlocked).toBe(true);
  });

  it("ajuste para ED (calculado D) permite refazer e não libera", () => {
    const r = computeLevelUnlocks([L("FUNDAMENTAL", [graded(1, "D", "ED")]), L("PROFESSIONAL")]);
    expect(r[0]).toMatchObject({ bestConcept: "ED", passed: false });
    expect(r[0]!.start).toEqual({ allowed: true, attemptNumber: 2 });
    expect(r[1]!.unlocked).toBe(false);
  });

  it("sem concept gravado usa o calculado; melhor conceito entre tentativas", () => {
    const r = computeLevelUnlocks([
      L("FUNDAMENTAL", [graded(1, "ED", null), graded(2, "ND", null)]),
    ]);
    expect(r[0]).toMatchObject({ lastConcept: "ND", bestConcept: "ED", passed: false });
    expect(effectiveConcept({ concept: null, computedConcept: "PD" })).toBe("PD");
    expect(bestConcept([graded(1, "ND", "PD"), graded(2, "D", null)])).toBe("PD");
  });

  it("nova tentativa não herda ajuste: em andamento não conta para o melhor conceito", () => {
    const attempts = [
      graded(1, "ND", "ED"),
      { attemptNumber: 2, status: "IN_PROGRESS" as const, concept: null, computedConcept: null },
    ];
    expect(bestConcept(attempts)).toBe("ED");
    expect(computeLevelUnlocks([L("FUNDAMENTAL", attempts)])[0]!.start).toEqual({
      allowed: false,
      reason: "IN_PROGRESS",
    });
  });
});
