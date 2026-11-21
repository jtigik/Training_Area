import { describe, expect, it } from "vitest";

import { userUpdateSchema } from "./user";

describe("userUpdateSchema", () => {
  it("normaliza e-mail e aceita campos parciais", () => {
    expect(userUpdateSchema.parse({ email: "  Fulano@Escola.EDU.br " })).toEqual({
      email: "fulano@escola.edu.br",
    });
    expect(userUpdateSchema.parse({ name: " Ana ", active: false })).toEqual({
      name: "Ana",
      active: false,
    });
  });

  it("recusa corpo vazio, campos inválidos e role", () => {
    for (const body of [
      {},
      { name: "  " },
      { email: "x" },
      { active: "false" },
      { role: "ALUNO" },
      { name: "A", tenantId: "t2" },
    ]) {
      expect(userUpdateSchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });
});
