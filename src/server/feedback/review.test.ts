// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { MockAiProvider } from "@/server/ai";
import type { Actor } from "@/server/domain";
import type { AttemptRecord } from "@/server/exercises";
import { gradeMultiCellSubmission, type MultiCellExercise } from "@/server/grading";

import {
  buildFeedbackPrompt,
  canTransition,
  FeedbackReviewService,
  findAnswerKeyLeaks,
  InMemoryFeedbackReviewRepository,
  InMemoryFeedbackTemplateRepository,
  parseFeedbackOutput,
  renderTemplate,
  resolveTemplate,
  type FeedbackTemplateRecord,
  type LevelCompletionInput,
} from "./index";

const T = "t1";
const teacher: Actor = { userId: "prof", role: "PROFESSOR", tenantId: T };
const alice: Actor = { userId: "alice", role: "ALUNO", tenantId: T };
const bob: Actor = { userId: "bob", role: "ALUNO", tenantId: T };

const content: MultiCellExercise = {
  sheet: { A1: 10, A2: 20, A3: 30 },
  targets: [{ cell: "A4", expected: { formula: "=SUM(A1:A3)" } }],
};
const exercises = [1, 2, 3, 4].map((n) => ({
  id: `e${n}`,
  title: `Exercício ${n}`,
  difficulty: "EASY" as const,
  content,
}));

function attempt(exerciseId: string, n: number, formula: string): AttemptRecord {
  const grading = gradeMultiCellSubmission(content, { A4: formula });
  return {
    id: `${exerciseId}-${n}`,
    tenantId: T,
    studentId: "alice",
    exerciseId,
    setId: "s1",
    level: "FUNDAMENTAL",
    difficulty: "EASY",
    levelCycle: 1,
    attemptNumber: n,
    submission: { A4: formula },
    isCorrect: grading.correct,
    clientIsCorrect: null,
    divergent: false,
    grading,
    createdAt: new Date("2026-11-21T12:00:00Z"),
  };
}

const completion = (over: Partial<LevelCompletionInput> = {}): LevelCompletionInput => ({
  studentId: "alice",
  setId: "s1",
  level: "FUNDAMENTAL",
  levelCycle: 1,
  requiredCount: 4,
  attempts: [
    attempt("e1", 1, "=SUM(A1:A3)"),
    attempt("e2", 1, "=A1+A2+A3"),
    attempt("e3", 1, "=60"),
    attempt("e3", 2, "=A1+20"),
    attempt("e4", 1, "=A1"),
  ],
  exercises,
  ...over,
});

let seq = 0;
let reviews: InMemoryFeedbackReviewRepository;
let templates: InMemoryFeedbackTemplateRepository;
let ai: MockAiProvider;
let service: FeedbackReviewService;

beforeEach(() => {
  seq = 0;
  reviews = new InMemoryFeedbackReviewRepository();
  templates = new InMemoryFeedbackTemplateRepository();
  ai = new MockAiProvider();
  service = new FeedbackReviewService({
    reviews,
    templates,
    ai,
    newId: () => `r${++seq}`,
    clock: { now: () => new Date("2026-11-21T12:30:00Z") },
  });
});

describe("conclusão de nível → rascunho por IA na fila", () => {
  it("calcula conceito, retry e cria DRAFT/GENERATED com análise no prompt", async () => {
    const r = await service.onLevelCompleted(T, completion());
    // e1, e2 correct; e3 wrong (hardcoded / wrong value), e4 wrong → 2/4 = 50% → ED
    expect(r).toMatchObject({
      status: "DRAFT",
      generationStatus: "GENERATED",
      generationError: null,
      concept: "ED",
      conceptPercent: 50,
      retry: { allowed: true },
    });
    expect(r.stats.frequentErrors.map((e) => e.code)).toContain("HARDCODED_VALUE");
    expect(r.stats.formulaHabits.attemptsWithHardcodedNumbers).toBeGreaterThan(0);
    expect(r.draft?.message).toContain("conceito ED");
    const prompt = ai.calls[0]!.messages.map((m) => m.content).join("\n");
    expect(prompt).toContain("habitosDeFormula");
    // only the student's own submissions; no answer keys / expected values
    expect(prompt).not.toMatch(/expectedValue|answerKeys|"formula"/);
    expect(prompt).not.toContain("alice");
  });

  it("é idempotente por ciclo e valida tenant das tentativas", async () => {
    const a = await service.onLevelCompleted(T, completion());
    const b = await service.onLevelCompleted(T, completion());
    expect(b.id).toBe(a.id);
    expect(ai.calls).toHaveLength(1);
    await expect(
      service.onLevelCompleted(
        T,
        completion({ levelCycle: 2, attempts: [{ ...attempt("e1", 1, "=A1"), tenantId: "x" }] }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("falha de IA vira generationStatus FAILED e pode ser regenerada", async () => {
    let call = 0;
    service = new FeedbackReviewService({
      reviews,
      templates,
      ai: new MockAiProvider(() =>
        ++call === 1
          ? "não é json"
          : JSON.stringify({ message: "Mensagem gerada na segunda tentativa." }),
      ),
      newId: () => `r${++seq}`,
    });
    const r = await service.onLevelCompleted(T, completion());
    expect(r).toMatchObject({ status: "DRAFT", generationStatus: "FAILED", draft: null });
    expect(r.generationError).toMatch(/INVALID_OUTPUT/);
    expect(r.generations[0]?.error).toMatch(/INVALID_OUTPUT/);
    const again = await service.regenerate(teacher, T, r.id, "Seja mais breve");
    expect(again).toMatchObject({
      status: "DRAFT",
      generationStatus: "GENERATED",
      generationError: null,
      version: 2,
    });
    expect(again.generations).toHaveLength(2);
    expect(again.generations[1]?.teacherGuidance).toBe("Seja mais breve");
  });

  it("sem IA usa o texto do template (regras) e ainda passa pela revisão", async () => {
    service = new FeedbackReviewService({ reviews, templates, ai: null, newId: () => `r${++seq}` });
    const r = await service.onLevelCompleted(T, completion());
    expect(r).toMatchObject({ status: "DRAFT", generationStatus: "GENERATED" });
    expect(r.generations[0]?.source).toBe("RULES");
    expect(r.draft?.message).toContain("conceito ED (Em desenvolvimento)");
    expect(r.draft?.message).toContain("2 de 4");
  });
});

describe("máquina de estados da revisão", () => {
  it("tabela de transições", () => {
    expect(canTransition("DRAFT", "approve")).toBe(true);
    expect(canTransition("DRAFT", "reject")).toBe(true);
    expect(canTransition("REJECTED", "approve")).toBe(true);
    expect(canTransition("REJECTED", "reject")).toBe(false);
    expect(canTransition("APPROVED", "regenerate")).toBe(false);
    expect(canTransition("APPROVED", "edit")).toBe(false);
  });

  it("aluno só vê feedback aprovado", async () => {
    const r = await service.onLevelCompleted(T, completion());
    expect(await service.getStudentFeedback(alice, T, "alice")).toEqual([]);
    const ok = await service.approve(teacher, T, r.id, {}, 1);
    expect(ok).toMatchObject({ status: "APPROVED", reviewerId: "prof", finalSource: "AI" });
    const seen = await service.getStudentFeedback(alice, T, "alice");
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ concept: "ED", canRetry: true });
    expect(seen[0]).not.toHaveProperty("answerKeys");
    await expect(service.getStudentFeedback(bob, T, "alice")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(service.approve(teacher, T, r.id)).rejects.toMatchObject({
      code: "ALREADY_REVIEWED",
    });
  });

  it("editar e aprovar, rejeitar, conflito de versão e limites", async () => {
    const r = await service.onLevelCompleted(T, completion());
    await expect(service.approve(alice, T, r.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const rej = await service.reject(teacher, T, r.id, "Tom inadequado");
    expect(rej).toMatchObject({ status: "REJECTED", rejectionReason: "Tom inadequado" });
    await expect(service.reject(teacher, T, r.id)).rejects.toMatchObject({
      code: "ALREADY_REVIEWED",
    });
    expect((await service.listQueue(teacher, T)).map((x) => x.id)).toEqual([r.id]);
    await expect(
      service.editAndApprove(teacher, T, r.id, { message: "curto" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      service.editAndApprove(teacher, T, r.id, { message: "Texto revisado pelo professor." }, 1),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const ed = await service.editAndApprove(teacher, T, r.id, {
      message: "Texto revisado pelo professor.",
      strengths: ["Usou SOMA"],
    });
    expect(ed).toMatchObject({
      status: "APPROVED",
      finalSource: "PROFESSOR",
      final: { strengths: ["Usou SOMA"], improvements: [] },
    });
    expect(await service.listQueue(teacher, T)).toEqual([]);
    expect((await service.getStudentFeedback(alice, T, "alice"))[0]?.content.message).toBe(
      "Texto revisado pelo professor.",
    );
  });

  it("motivo de rejeição é opcional", async () => {
    const r = await service.onLevelCompleted(T, completion());
    const rej = await service.reject(teacher, T, r.id);
    expect(rej).toMatchObject({ status: "REJECTED", rejectionReason: null });
  });

  it("geração FAILED: aprova com finalText do professor, nunca sem texto", async () => {
    service = new FeedbackReviewService({
      reviews,
      templates,
      ai: new MockAiProvider(() => "não é json"),
      newId: () => `r${++seq}`,
    });
    const r = await service.onLevelCompleted(T, completion());
    expect(r.generationStatus).toBe("FAILED");
    await expect(service.approve(teacher, T, r.id)).rejects.toMatchObject({
      code: "GENERATION_NOT_READY",
    });
    await expect(service.approve(teacher, T, r.id, { finalText: "   " })).rejects.toMatchObject({
      code: "GENERATION_NOT_READY",
    });
    const ok = await service.approve(teacher, T, r.id, {
      finalText: "  Bom trabalho com SOMA; revise referências.  ",
    });
    expect(ok).toMatchObject({
      status: "APPROVED",
      generationStatus: "FAILED",
      finalText: "Bom trabalho com SOMA; revise referências.",
      finalSource: "PROFESSOR",
      final: { message: "Bom trabalho com SOMA; revise referências.", strengths: [] },
    });
    const seen = await service.getStudentFeedback(alice, T, "alice");
    expect(seen[0]?.content.message).toBe("Bom trabalho com SOMA; revise referências.");
  });

  it("PATCH finalText salva sem aprovar e é usado no approve", async () => {
    service = new FeedbackReviewService({
      reviews,
      templates,
      ai: new MockAiProvider(() => "não é json"),
      newId: () => `r${++seq}`,
    });
    const r = await service.onLevelCompleted(T, completion());
    const edited = await service.updateFinalText(teacher, T, r.id, "Texto manual do professor.");
    expect(edited).toMatchObject({ status: "DRAFT", finalText: "Texto manual do professor." });
    expect(await service.getStudentFeedback(alice, T, "alice")).toEqual([]);
    const ok = await service.approve(teacher, T, r.id);
    expect(ok.final?.message).toBe("Texto manual do professor.");
    await expect(service.updateFinalText(teacher, T, r.id, "x")).rejects.toMatchObject({
      code: "ALREADY_REVIEWED",
    });
  });

  it("approve com finalText em rascunho GENERATED usa o texto do professor", async () => {
    const r = await service.onLevelCompleted(T, completion());
    const ok = await service.approve(teacher, T, r.id, { finalText: "Ajustei o texto da IA." });
    expect(ok).toMatchObject({
      finalSource: "PROFESSOR",
      final: { message: "Ajustei o texto da IA." },
    });
    expect(ok.final?.strengths).toEqual(r.draft?.strengths);
  });

  it("limita regenerações e isola tenants", async () => {
    const r = await service.onLevelCompleted(T, completion());
    for (let i = 0; i < 4; i += 1) await service.regenerate(teacher, T, r.id);
    await expect(service.regenerate(teacher, T, r.id)).rejects.toMatchObject({
      code: "NOT_ALLOWED",
    });
    await expect(
      service.getForReview({ ...teacher, tenantId: "t2" }, "t2", r.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.getForReview({ ...teacher, tenantId: "t2" }, T, r.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("templates, prompt e saída", () => {
  const tpl = (over: Partial<FeedbackTemplateRecord>): FeedbackTemplateRecord => ({
    id: "x",
    tenantId: T,
    setId: null,
    level: null,
    concept: null,
    instructions: "geral",
    rules: [],
    fallbackText: "Texto {{conceito}}",
    version: 1,
    updatedAt: new Date(0),
    ...over,
  });

  it("escolhe o template mais específico", () => {
    const list = [
      tpl({ id: "set", setId: "s1" }),
      tpl({ id: "set-level-concept", setId: "s1", level: "FUNDAMENTAL", concept: "ND" }),
      tpl({ id: "set-level", setId: "s1", level: "FUNDAMENTAL" }),
      tpl({ id: "other-set", setId: "s2", level: "FUNDAMENTAL", concept: "ED" }),
    ];
    expect(resolveTemplate(list, { setId: "s1", level: "FUNDAMENTAL", concept: "ED" }).id).toBe(
      "set-level",
    );
    expect(resolveTemplate(list, { setId: "s1", level: "FUNDAMENTAL", concept: "ND" }).id).toBe(
      "set-level-concept",
    );
    expect(resolveTemplate([], { setId: "s1", level: "ADVANCED", concept: "PD" }).id).toBe(
      "platform-default",
    );
  });

  it("renderiza placeholders conhecidos e mantém os desconhecidos", () => {
    expect(renderTemplate("{{ conceito }} - {{outro}}", { conceito: "PD" })).toBe("PD - {{outro}}");
  });

  it("prompt inclui instruções, regras e orientação do professor", async () => {
    templates.items.push(
      tpl({
        id: "t",
        setId: "s1",
        instructions: "Foque em {{funcoesMaisUsadas}}",
        rules: ["Cite PROCV"],
      }),
    );
    const r = await service.onLevelCompleted(T, completion());
    const msgs = buildFeedbackPrompt({
      level: r.level,
      concept: r.concept,
      conceptPercent: r.conceptPercent,
      retry: r.retry,
      stats: r.stats,
      template: r.template,
      teacherGuidance: "mais curto",
    });
    expect(msgs[0]?.content).toContain("Foque em SUM");
    expect(msgs[0]?.content).toContain("- Cite PROCV");
    expect(msgs[0]?.content).toContain("mais curto");
    expect(msgs[1]?.content).toMatch(/<dados>\{[\s\S]*\}<\/dados>/);
  });

  it("parseia saída com cercas e detecta vazamento de gabarito", () => {
    const p = parseFeedbackOutput(
      'Claro!\n```json\n{"message":"Use =soma(a1:a3) da próxima vez, ok?"}\n```',
    );
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.content.strengths).toEqual([]);
      expect(findAnswerKeyLeaks(p.content, ["=SUM(A1:A3)", "=SOMA(A1:A3)"])).toEqual([
        "=SOMA(A1:A3)",
      ]);
    }
    expect(parseFeedbackOutput("sem json")).toEqual({ ok: false, error: "NO_JSON_OBJECT" });
    expect(parseFeedbackOutput('{"message": 1}').ok).toBe(false);
  });

  it("marca rascunho de IA que vaza o gabarito", async () => {
    service = new FeedbackReviewService({
      reviews,
      templates,
      ai: new MockAiProvider(() =>
        JSON.stringify({ message: "A resposta era =SUM(A1:A3), simples assim." }),
      ),
    });
    const r = await service.onLevelCompleted(T, completion());
    expect(r.generations[0]?.warnings).toEqual(["POSSIBLE_ANSWER_KEY_LEAK"]);
  });
});
