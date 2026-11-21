import { describe, expect, it } from "vitest";

import { MODEL_SCOPES, scopeArgs, TenantScopeError } from "./tenant-scope";
import { ModelName } from "@/generated/prisma/internal/prismaNamespace";

const T = "tenant-a";

describe("MODEL_SCOPES", () => {
  it("cobre todos os modelos do schema (novo modelo exige decidir o escopo)", () => {
    expect(Object.keys(MODEL_SCOPES).sort()).toEqual(Object.values(ModelName).sort());
  });
});

describe("scopeArgs — modelos do tenant", () => {
  it("injeta tenantId nas leituras preservando o filtro original", () => {
    expect(scopeArgs("ExerciseSet", "findMany", { where: { status: "PUBLISHED" } }, T)).toEqual({
      where: { status: "PUBLISHED", AND: [{ tenantId: T }] },
    });
    expect(scopeArgs("Feedback", "count", undefined, T)).toEqual({
      where: { AND: [{ tenantId: T }] },
    });
  });

  it("mantém campos únicos no topo em findUnique/update/delete", () => {
    const args = scopeArgs("LevelAttempt", "findUnique", { where: { id: "x" } }, T);
    expect(args.where).toEqual({ id: "x", AND: [{ tenantId: T }] });
    expect(scopeArgs("User", "delete", { where: { id: "u" } }, T).where).toEqual({
      id: "u",
      AND: [{ tenantId: T }],
    });
  });

  it("acrescenta ao AND existente (objeto ou lista)", () => {
    expect(scopeArgs("Level", "findFirst", { where: { AND: { position: 1 } } }, T).where).toEqual({
      AND: [{ position: 1 }, { tenantId: T }],
    });
  });

  it("injeta tenantId no create/createMany e recusa outro tenant", () => {
    expect(scopeArgs("Classroom", "create", { data: { name: "Turma" } }, T).data).toEqual({
      name: "Turma",
      tenantId: T,
    });
    expect(
      scopeArgs("Classroom", "createMany", { data: [{ name: "A" }, { name: "B", tenantId: T }] }, T)
        .data,
    ).toEqual([
      { name: "A", tenantId: T },
      { name: "B", tenantId: T },
    ]);
    expect(() =>
      scopeArgs("Classroom", "create", { data: { name: "X", tenantId: "outro" } }, T),
    ).toThrow(TenantScopeError);
    expect(() =>
      scopeArgs(
        "Classroom",
        "create",
        { data: { name: "X", tenant: { connect: { id: "outro" } } } },
        T,
      ),
    ).toThrow(TenantScopeError);
  });

  it("update/upsert não podem mover registro de tenant", () => {
    expect(() =>
      scopeArgs("User", "update", { where: { id: "u" }, data: { tenantId: "outro" } }, T),
    ).toThrow(TenantScopeError);
    expect(() =>
      scopeArgs("User", "updateMany", { where: {}, data: { tenant: { connect: { id: "b" } } } }, T),
    ).toThrow(TenantScopeError);
    const upsert = scopeArgs(
      "TenantGradingConfig",
      "upsert",
      {
        where: { tenantId: T },
        create: { edMinPercent: 40, dMinPercent: 60, pdMinPercent: 80 },
        update: { edMinPercent: 40 },
      },
      T,
    );
    expect(upsert.where).toEqual({ tenantId: T, AND: [{ tenantId: T }] });
    expect(upsert.create).toMatchObject({ tenantId: T });
  });
});

describe("scopeArgs — globais (Exercise, ContentSection)", () => {
  it("leitura vê o tenant + globais", () => {
    expect(scopeArgs("Exercise", "findMany", { where: { level: "FUNDAMENTAL" } }, T).where).toEqual(
      {
        level: "FUNDAMENTAL",
        AND: [{ OR: [{ tenantId: T }, { tenantId: null }] }],
      },
    );
  });

  it("escrita só no próprio tenant (globais intocáveis)", () => {
    expect(
      scopeArgs("Exercise", "update", { where: { id: "e" }, data: { title: "t" } }, T).where,
    ).toEqual({
      id: "e",
      AND: [{ tenantId: T }],
    });
    expect(scopeArgs("ContentSection", "deleteMany", {}, T).where).toEqual({
      AND: [{ tenantId: T }],
    });
  });

  it("create força isGlobal = false e recusa global", () => {
    expect(scopeArgs("Exercise", "create", { data: { title: "t" } }, T).data).toEqual({
      title: "t",
      tenantId: T,
      isGlobal: false,
    });
    expect(() =>
      scopeArgs("Exercise", "create", { data: { title: "t", isGlobal: true } }, T),
    ).toThrow(TenantScopeError);
    expect(() =>
      scopeArgs("Exercise", "update", { where: { id: "e" }, data: { isGlobal: true } }, T),
    ).toThrow(TenantScopeError);
  });
});

describe("scopeArgs — Tenant e autenticação", () => {
  it("Tenant: só o próprio, somente leitura", () => {
    expect(scopeArgs("Tenant", "findFirst", {}, T).where).toEqual({ AND: [{ id: T }] });
    expect(() => scopeArgs("Tenant", "update", { where: { id: T }, data: {} }, T)).toThrow(
      TenantScopeError,
    );
  });

  it("Session/Account/Verification bloqueados; tenantId vazio recusado", () => {
    for (const model of ["Session", "Account", "Verification"]) {
      expect(() => scopeArgs(model, "findMany", {}, T)).toThrow(TenantScopeError);
    }
    expect(() => scopeArgs("User", "findMany", {}, "")).toThrow(TenantScopeError);
    expect(() => scopeArgs("Desconhecido", "findMany", {}, T)).toThrow(TenantScopeError);
  });
});
