import { describe, expect, it } from "vitest";
import { ApiError } from "../contracts";
import { createMockServices } from ".";

describe("mock services", () => {
  it("recusa e-mail duplicado", async () => {
    const s = createMockServices();
    await expect(
      s.users.create({
        name: "X",
        email: "PAULO@training.local",
        role: "STUDENT",
        onboarding: "convite",
      }),
    ).rejects.toMatchObject({ status: 409, code: "email_duplicado" });
  });

  it("recusa rebaixar o último admin", async () => {
    const s = createMockServices();
    await expect(s.users.update("u-admin", { role: "TEACHER" })).rejects.toBeInstanceOf(ApiError);
    const u = await s.users.update("u-prof", { role: "ADMIN" });
    expect(u.role).toBe("ADMIN");
    expect((await s.users.update("u-admin", { active: false })).active).toBe(false);
  });

  it("pagina e busca usuários", async () => {
    const s = createMockServices();
    const p = await s.users.list({ pageSize: 2, page: 2 });
    expect(p.items).toHaveLength(2);
    expect(p.total).toBe(7);
    expect((await s.users.list({ search: "beatriz" })).total).toBe(1);
  });

  it("seções: cria rascunho, reordena e restaura arquivada como rascunho", async () => {
    const s = createMockServices();
    const sec = await s.sections.create({ title: "Nova", body: "x", level: null });
    expect(sec.status).toBe("rascunho");
    const ids = (await s.sections.list()).map((x) => x.id).reverse();
    expect((await s.sections.reorder(ids)).map((x) => x.id)).toEqual(ids);
    await s.sections.setStatus("sec-1", "arquivado");
    await expect(s.sections.setStatus("sec-1", "publicado")).rejects.toMatchObject({ status: 422 });
    expect((await s.sections.setStatus("sec-1", "rascunho")).status).toBe("rascunho");
  });

  it("conjuntos: bloqueia publicação sem pool e remoção de nível com progresso", async () => {
    const s = createMockServices();
    const set = await s.sets.create({
      name: "Novo",
      description: "",
      levels: ["avancado"],
      difficulties: ["dificil"],
      quantities: [{ level: "avancado", difficulty: null, quantity: 1 }],
      overrides: [],
    });
    await expect(s.sets.publish(set.id)).rejects.toMatchObject({ code: "publicacao_bloqueada" });
    await expect(s.sets.update("set-1", { levels: ["profissional"] })).rejects.toMatchObject({
      code: "nivel_com_progresso",
    });
  });

  it("exercícios: recusa nível fora do conjunto e devolve dados iguais ao reabrir", async () => {
    const s = createMockServices();
    const base = {
      title: "T",
      statement: "E",
      difficulty: "facil" as const,
      grid: { rows: 2, cols: 2, cells: { A1: { value: "2", locked: true } } },
      answers: { B1: { kind: "formula" as const, expected: "=A1*2" } },
      hint: null,
      published: true,
    };
    await expect(
      s.exercises.create("set-1", { ...base, level: "dashboard" }),
    ).rejects.toMatchObject({ code: "nivel_fora_do_conjunto" });
    const ex = await s.exercises.create("set-1", { ...base, level: "fundamental" });
    const again = await s.exercises.get(ex.id);
    expect(again.grid).toEqual(base.grid);
    expect(again.answers).toEqual(base.answers);
  });

  it("feedback: usa padrão quando não há faixas do conjunto e valida cobertura", async () => {
    const s = createMockServices();
    expect((await s.feedback.get("set-1")).bands).toHaveLength(3);
    await expect(
      s.feedback.save({
        setId: "set-1",
        bands: [{ minPercent: 0, maxPercent: 40, label: "a", template: "b" }],
      }),
    ).rejects.toMatchObject({ code: "faixas_invalidas" });
  });
});
