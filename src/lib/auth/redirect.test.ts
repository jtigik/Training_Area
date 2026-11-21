import { describe, expect, it } from "vitest";
import { postLoginPath } from "./redirect";

describe("postLoginPath", () => {
  it("honours ?voltar= inside the role's area", () => {
    expect(postLoginPath("STUDENT", "/aluno/exercicios/ex-1")).toBe("/aluno/exercicios/ex-1");
    expect(postLoginPath("STUDENT", "/aluno?x=1")).toBe("/aluno?x=1");
    expect(postLoginPath("ADMIN", "/admin/configuracoes")).toBe("/admin/configuracoes");
  });

  it("falls back to the role home for other areas or unsafe targets", () => {
    expect(postLoginPath("STUDENT", "/admin/usuarios")).toBe("/aluno");
    expect(postLoginPath("STUDENT", "/alunox")).toBe("/aluno");
    expect(postLoginPath("STUDENT", "//evil.example/aluno")).toBe("/aluno");
    expect(postLoginPath("STUDENT", "https://evil.example")).toBe("/aluno");
    expect(postLoginPath("TEACHER", null)).toBe("/professor/resultados");
  });
});
