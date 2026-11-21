import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../contracts";
import { createMockServices } from ".";
import { createSeed } from "./seed";

const content = {
  title: "T",
  statement: "E",
  difficulty: "EASY" as const,
  grid: { rows: 2, cols: 2, cells: { A1: { value: "2", locked: true } } },
  answers: { B1: { kind: "FORMULA" as const, expected: "=A1*2" } },
  hint: null,
};

describe("mock: multi-tenant", () => {
  it("lista só dados da instituição da sessão", async () => {
    const s = createMockServices();
    const users = await s.users.list({ pageSize: 50 });
    expect(users.items.every((u) => u.institutionId === "inst-1")).toBe(true);
    expect(users.total).toBe(7);
    expect((await s.sections.list()).map((x) => x.id)).not.toContain("sec-b1");
    await expect(s.sections.get("sec-b1")).rejects.toMatchObject({ status: 404 });
    const other = createMockServices({ institutionId: "inst-2" });
    expect((await other.users.list()).total).toBe(3);
  });

  it("super admin cria instituição com primeiro admin e desativa", async () => {
    const s = createMockServices();
    const inst = await s.institutions.create({
      name: "Nova",
      slug: "nova",
      domains: ["nova.edu.br"],
      adminName: "Admin Nova",
      adminEmail: "admin@nova.edu.br",
    });
    expect(inst.active).toBe(true);
    expect(s.db.users.find((u) => u.email === "admin@nova.edu.br")).toMatchObject({
      role: "INSTITUTION_ADMIN",
      institutionId: inst.id,
    });
    await expect(
      s.institutions.create({
        name: "X",
        slug: "nova",
        domains: ["x.com"],
        adminName: "a",
        adminEmail: "a@x.com",
      }),
    ).rejects.toMatchObject({ code: "slug_duplicado" });
    expect((await s.institutions.update(inst.id, { active: false })).active).toBe(false);
    expect((await s.institutions.list({ active: true })).map((i) => i.id)).not.toContain(inst.id);
  });
});

describe("mock: usuários e configurações", () => {
  it("recusa e-mail duplicado", async () => {
    const s = createMockServices();
    await expect(
      s.users.create({ name: "X", email: "PAULO@escola.edu.br", role: "ALUNO" }),
    ).rejects.toMatchObject({
      status: 409,
      code: "email_duplicado",
    });
  });

  it("recusa rebaixar o último admin da instituição", async () => {
    const s = createMockServices();
    await expect(s.users.update("u-admin", { role: "PROFESSOR" })).rejects.toBeInstanceOf(ApiError);
    await s.users.update("u-prof", { role: "INSTITUTION_ADMIN" });
    expect((await s.users.update("u-admin", { active: false })).active).toBe(false);
  });

  it("pagina e busca usuários", async () => {
    const s = createMockServices();
    const p = await s.users.list({ pageSize: 2, page: 2 });
    expect(p.items).toHaveLength(2);
    expect((await s.users.list({ search: "beatriz" })).total).toBe(1);
  });

  it("salva configurações da instituição e chama persist", async () => {
    const persist = vi.fn();
    const s = createMockServices({ persist });
    const saved = await s.settings.update({ instanceName: "Nome novo", openSignup: true });
    expect(saved).toMatchObject({
      institutionId: "inst-1",
      instanceName: "Nome novo",
      openSignup: true,
    });
    expect(persist).toHaveBeenCalled();
  });
});

describe("mock: conteúdo, conjuntos e exercícios", () => {
  it("seções: cria rascunho, reordena e restaura arquivada como rascunho", async () => {
    const s = createMockServices();
    const sec = await s.sections.create({ title: "Nova", body: "x", level: null });
    expect(sec.status).toBe("DRAFT");
    const ids = (await s.sections.list()).map((x) => x.id).reverse();
    expect((await s.sections.reorder(ids)).map((x) => x.id)).toEqual(ids);
    await s.sections.setStatus("sec-1", "ARCHIVED");
    await expect(s.sections.setStatus("sec-1", "PUBLISHED")).rejects.toMatchObject({ status: 422 });
    expect((await s.sections.setStatus("sec-1", "DRAFT")).status).toBe("DRAFT");
  });

  it("conjuntos: bloqueia publicação sem pool e remoção de nível com progresso", async () => {
    const s = createMockServices();
    const set = await s.sets.create({
      name: "Novo",
      description: "",
      levels: ["ADVANCED"],
      difficulties: ["HARD"],
      quantities: [{ level: "ADVANCED", difficulty: null, quantity: 1 }],
      overrides: [],
    });
    expect(set.status).toBe("DRAFT");
    await expect(s.sets.publish(set.id)).rejects.toMatchObject({ code: "publicacao_bloqueada" });
    await expect(s.sets.update("set-1", { levels: ["PROFESSIONAL"] })).rejects.toMatchObject({
      code: "nivel_com_progresso",
    });
  });

  it("exercícios: recusa nível fora do conjunto e reabre igual", async () => {
    const s = createMockServices();
    await expect(
      s.exercises.create("set-1", { ...content, level: "ADVANCED", status: "DRAFT" }),
    ).rejects.toMatchObject({
      code: "nivel_fora_do_conjunto",
    });
    await expect(
      s.exercises.create("set-1", {
        ...content,
        answers: {},
        level: "FUNDAMENTAL",
        status: "DRAFT",
      }),
    ).rejects.toMatchObject({ code: "gabarito_invalido" });
    const ex = await s.exercises.create("set-1", {
      ...content,
      level: "FUNDAMENTAL",
      status: "DRAFT",
    });
    const again = await s.exercises.get(ex.id);
    expect(again.grid).toEqual(content.grid);
    expect(again.answers).toEqual(content.answers);
  });
});

describe("mock: banco de exercícios", () => {
  it("mostra banco da plataforma + da instituição, nunca de outra instituição", async () => {
    const s = createMockServices();
    const all = await s.bank.list();
    expect(all.some((b) => b.origin === "PLATFORM")).toBe(true);
    expect(all.some((b) => b.id === "bank-i1")).toBe(true);
    expect(all.some((b) => b.id === "bank-b1")).toBe(false);
    expect((await s.bank.list({ level: "ADVANCED" })).every((b) => b.level === "ADVANCED")).toBe(
      true,
    );
  });

  it("copia item para conjunto como rascunho e protege itens da plataforma", async () => {
    const s = createMockServices();
    const ex = await s.bank.copyToSet("bank-3", "set-1");
    expect(ex).toMatchObject({
      setId: "set-1",
      bankItemId: "bank-3",
      status: "DRAFT",
      title: "Maior venda",
    });
    await expect(s.bank.copyToSet("bank-6", "set-1")).rejects.toMatchObject({
      code: "nivel_fora_do_conjunto",
    });
    await expect(s.bank.update("bank-1", { title: "x" })).rejects.toMatchObject({ status: 403 });
    expect((await s.bank.update("bank-i1", { title: "Desconto" })).title).toBe("Desconto");
  });

  it("itens criados no banco começam em rascunho e não vão para conjuntos", async () => {
    const s = createMockServices();
    const created = await s.bank.create({
      ...content,
      level: "FUNDAMENTAL",
      tags: [],
      status: "DRAFT",
    });
    await expect(s.bank.copyToSet(created.id, "set-1")).rejects.toMatchObject({
      code: "item_em_rascunho",
    });
  });
});

async function xlsxFile(withAnswer = true, level = "Fundamental") {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const dados = wb.addWorksheet("Dados");
  [
    ["Título", "Soma importada"],
    ["Nível", level],
    ["Dificuldade", "Muito fácil"],
    ["Enunciado", "Some."],
  ].forEach((r) => dados.addRow(r));
  wb.addWorksheet("Planilha").getCell("A1").value = 10;
  const g = wb.addWorksheet("Gabarito");
  g.addRow(["Célula", "Resposta"]);
  if (withAnswer) g.addRow(["A2", "=SOMA(A1)"]);
  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return new File([buf], "ex.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("mock: importação .xlsx por conjunto", () => {
  it("preview não grava; import cria exercícios em rascunho no conjunto", async () => {
    const s = createMockServices();
    const before = (await s.exercises.listBySet("set-1")).length;
    const preview = await s.exercises.previewImport("set-1", await xlsxFile());
    expect(preview.errors).toEqual([]);
    expect(preview.drafts[0]).toMatchObject({ title: "Soma importada", level: "FUNDAMENTAL" });
    expect((await s.exercises.listBySet("set-1")).length).toBe(before);
    const { created } = await s.exercises.importXlsx("set-1", await xlsxFile());
    expect(created[0]).toMatchObject({ setId: "set-1", status: "DRAFT" });
    expect((await s.exercises.listBySet("set-1")).length).toBe(before + 1);
  });

  it("tudo ou nada: sem gabarito → 422 IMPORT_INVALID com aba/célula", async () => {
    const s = createMockServices();
    await expect(s.exercises.importXlsx("set-1", await xlsxFile(false))).rejects.toMatchObject({
      status: 422,
      code: "IMPORT_INVALID",
      details: {
        errors: [expect.objectContaining({ sheet: "Gabarito", code: "MISSING_ANSWER_KEY" })],
      },
    });
  });

  it("recusa nível fora do conjunto e arquivo que não é .xlsx", async () => {
    const s = createMockServices();
    const preview = await s.exercises.previewImport("set-1", await xlsxFile(true, "Avançado"));
    expect(preview.errors.map((e) => e.code)).toContain("LEVEL_NOT_IN_SET");
    const csv = new File(["A1,10"], "x.csv", { type: "text/csv" });
    expect((await s.exercises.previewImport("set-1", csv)).errors[0].code).toBe("FILE_UNREADABLE");
  });
});

describe("mock: feedback", () => {
  it("templates: usa padrão e valida cobertura", async () => {
    const s = createMockServices();
    const def = await s.feedback.get("set-1");
    expect(def.setId).toBeNull();
    expect(def.bands).toHaveLength(3);
    await expect(
      s.feedback.save({
        setId: "set-1",
        bands: [{ minPercent: 0, maxPercent: 40, label: "a", template: "b" }],
      }),
    ).rejects.toMatchObject({ code: "faixas_invalidas" });
  });

  it("fila de revisão: edita, aprova, rejeita e impede revisar de novo", async () => {
    const s = createMockServices();
    expect((await s.reviews.list({ status: ["DRAFT"] })).map((r) => r.id)).toEqual([
      "rv-1",
      "rv-2",
    ]);
    await s.reviews.saveDraft("rv-1", "Texto revisado");
    const ok = await s.reviews.approve("rv-1", "Texto revisado final");
    expect(ok).toMatchObject({
      status: "APPROVED",
      finalText: "Texto revisado final",
      reviewerId: "u-prof",
    });
    expect(ok.generatedText).not.toBe(ok.finalText);
    await expect(s.reviews.reject("rv-1", "motivo")).rejects.toMatchObject({ code: "ja_revisado" });
    expect(await s.reviews.reject("rv-2")).toMatchObject({
      status: "REJECTED",
      rejectionReason: null,
    });
    // Rejeitado volta ao professor: continua na fila "a revisar" e pode ser regenerado.
    expect((await s.reviews.list({ status: ["DRAFT", "REJECTED"] })).map((r) => r.id)).toEqual([
      "rv-2",
    ]);
    await expect(s.reviews.reject("rv-2")).rejects.toMatchObject({ code: "ja_revisado" });
    const again = await s.reviews.regenerate("rv-2");
    expect(again).toMatchObject({ status: "DRAFT", reviewerId: null });
    expect(again.finalText).toBe(again.generatedText);
  });
});

describe("mock: resultados e refazer nível", () => {
  it("refaz nível com ND e recusa com D", async () => {
    const s = createMockServices({ db: createSeed() });
    const p = await s.results.redoLevel("u-al2", "set-1", "FUNDAMENTAL");
    expect(p).toMatchObject({ levelAttempt: 2, status: "IN_PROGRESS", concept: null });
    expect(p.history).toHaveLength(2);
    await expect(s.results.redoLevel("u-al1", "set-1", "FUNDAMENTAL")).rejects.toMatchObject({
      code: "refazer_nao_permitido",
    });
  });

  it("detalhe do aluno ordena tentativas da mais recente para a mais antiga", async () => {
    const s = createMockServices();
    const d = await s.results.student("u-al1");
    expect(d.attempts[0].id).toBe("a-4");
    expect(d.attempts[0]).not.toHaveProperty("institutionId");
  });
});
