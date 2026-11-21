import { describe, expect, it } from "vitest";
import { callbackTarget, postLoginPath } from "./redirect";

describe("postLoginPath", () => {
  it("honours callbackUrl inside the role's area", () => {
    expect(postLoginPath("ALUNO", "/aluno/exercicios/ex-1")).toBe("/aluno/exercicios/ex-1");
    expect(postLoginPath("ALUNO", "/aluno?x=1")).toBe("/aluno?x=1");
    expect(postLoginPath("INSTITUTION_ADMIN", "/admin/configuracoes")).toBe("/admin/configuracoes");
    expect(postLoginPath("SUPER_ADMIN", "/super-admin/x")).toBe("/super-admin/x");
    expect(postLoginPath("SUPER_ADMIN", "/superadmin/x")).toBe("/super-admin/instituicoes");
  });

  it("falls back to the role home for other areas or unsafe targets", () => {
    expect(postLoginPath("ALUNO", "/admin/usuarios")).toBe("/aluno");
    expect(postLoginPath("ALUNO", "/alunox")).toBe("/aluno");
    expect(postLoginPath("ALUNO", "//evil.example/aluno")).toBe("/aluno");
    expect(postLoginPath("ALUNO", "/\\evil.example")).toBe("/aluno");
    expect(postLoginPath("ALUNO", "https://evil.example")).toBe("/aluno");
    expect(postLoginPath("PROFESSOR", null)).toBe("/professor/resultados");
    expect(postLoginPath("SUPER_ADMIN", undefined)).toBe("/super-admin/instituicoes");
  });
});

describe("callbackTarget", () => {
  it("reads callbackUrl and accepts the legacy voltar alias", () => {
    expect(callbackTarget(new URLSearchParams("callbackUrl=%2Faluno"))).toBe("/aluno");
    expect(callbackTarget(new URLSearchParams("voltar=%2Faluno%2Fconteudo"))).toBe(
      "/aluno/conteudo",
    );
    expect(callbackTarget(new URLSearchParams("callbackUrl=/a&voltar=/b"))).toBe("/a");
    expect(callbackTarget(new URLSearchParams(""))).toBeNull();
  });
});
