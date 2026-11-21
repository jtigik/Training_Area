import { describe, expect, it } from "vitest";

import { tenantCreateSchema, tenantUpdateSchema } from "./tenant";

describe("tenant schemas", () => {
  it("autoJoinByDomain é false por padrão; domínios e slug normalizados", () => {
    expect(
      tenantCreateSchema.parse({
        name: "Escola X",
        slug: "Escola-X",
        emailDomains: ["Escola.EDU.br"],
      }),
    ).toEqual({
      name: "Escola X",
      slug: "escola-x",
      emailDomains: ["escola.edu.br"],
      autoJoinByDomain: false,
      locale: "pt-BR",
    });
  });

  it("recusa slug/domínio inválidos e update vazio", () => {
    expect(tenantCreateSchema.safeParse({ name: "X X", slug: "com espaço" }).success).toBe(false);
    expect(
      tenantCreateSchema.safeParse({ name: "X X", slug: "x", emailDomains: ["@gmail"] }).success,
    ).toBe(false);
    expect(tenantUpdateSchema.safeParse({}).success).toBe(false);
    expect(tenantUpdateSchema.parse({ active: false })).toEqual({ active: false });
  });
});
