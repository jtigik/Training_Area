import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  authorizeRoute,
  findRouteRule,
  isNonMvpLevelPath,
  matchesPrefix,
  PROTECTED_PREFIXES,
  safeCallbackPath,
} from "./route-rules";

const superAdmin = { role: "SUPER_ADMIN", tenantId: null };
const instAdmin = { role: "INSTITUTION_ADMIN", tenantId: "t1" };
const professor = { role: "PROFESSOR", tenantId: "t1" };
const aluno = { role: "ALUNO", tenantId: "t1" };

describe("matchesPrefix", () => {
  it("casa por segmento", () => {
    expect(matchesPrefix("/admin", "/admin")).toBe(true);
    expect(matchesPrefix("/admin/usuarios", "/admin")).toBe(true);
    expect(matchesPrefix("/administrar", "/admin")).toBe(false);
  });
});

describe("authorizeRoute", () => {
  it("libera rotas públicas e sem regra", () => {
    expect(authorizeRoute("/", null).type).toBe("allow");
    expect(authorizeRoute("/login", null).type).toBe("allow");
    expect(authorizeRoute("/api/auth/sign-in/social", null).type).toBe("allow");
    expect(authorizeRoute("/api/health", null).type).toBe("allow");
  });

  it("anônimo em rota protegida → unauthenticated", () => {
    for (const p of [
      "/admin",
      "/super-admin",
      "/professor/x",
      "/aluno",
      "/api/me",
      "/api/admin/users",
    ]) {
      expect(authorizeRoute(p, null).type).toBe("unauthenticated");
    }
  });

  it("usuário desativado é tratado como anônimo", () => {
    expect(authorizeRoute("/aluno", { ...aluno, active: false }).type).toBe("unauthenticated");
  });

  // Matriz papel × área (decisão do PO 03:26): página e API.
  const USERS = {
    SUPER_ADMIN: superAdmin,
    INSTITUTION_ADMIN: instAdmin,
    PROFESSOR: professor,
    ALUNO: aluno,
  };
  const AREAS = [
    { owner: "ALUNO", page: "/aluno/niveis/fundamental", api: "/api/aluno/feedbacks" },
    {
      owner: "PROFESSOR",
      page: "/professor/resultados",
      api: "/api/professor/level-attempts/1/concept",
    },
    { owner: "INSTITUTION_ADMIN", page: "/admin/usuarios", api: "/api/admin/users/1/role" },
    { owner: "SUPER_ADMIN", page: "/super-admin/instituicoes", api: "/api/super-admin/metrics" },
  ] as const;
  const HOME = {
    SUPER_ADMIN: "/super-admin",
    INSTITUTION_ADMIN: "/admin",
    PROFESSOR: "/professor",
    ALUNO: "/aluno",
  } as const;

  for (const area of AREAS) {
    for (const [role, user] of Object.entries(USERS) as [
      keyof typeof USERS,
      (typeof USERS)[keyof typeof USERS],
    ][]) {
      const allowed = role === area.owner;
      it(`${role} em ${area.page} e ${area.api} → ${allowed ? "allow" : `forbidden (home ${HOME[role]})`}`, () => {
        for (const path of [area.page, area.api]) {
          const decision = authorizeRoute(path, user);
          if (allowed) expect(decision).toEqual({ type: "allow" });
          else expect(decision).toEqual({ type: "forbidden", home: HOME[role] });
        }
      });
    }
  }

  it("PROFESSOR não tem prévia do aluno", () => {
    expect(authorizeRoute("/aluno", professor).type).toBe("forbidden");
    expect(authorizeRoute("/api/aluno/sets/x/progress", professor).type).toBe("forbidden");
  });

  it("exceções do SUPER_ADMIN dentro da instituição: grading-config e invitations", () => {
    for (const p of ["/api/admin/grading-config", "/api/admin/invitations"]) {
      expect(authorizeRoute(p, superAdmin).type).toBe("allow");
      expect(authorizeRoute(p, instAdmin).type).toBe("allow");
      expect(authorizeRoute(p, professor).type).toBe("forbidden");
      expect(authorizeRoute(p, aluno).type).toBe("forbidden");
    }
    expect(authorizeRoute("/api/admin/users/1", superAdmin).type).toBe("forbidden");
    expect(authorizeRoute("/admin", superAdmin).type).toBe("forbidden");
  });

  it("papel de instituição sem tenantId não entra", () => {
    expect(authorizeRoute("/aluno", { role: "ALUNO", tenantId: null }).type).toBe("forbidden");
  });

  it("/api/me: qualquer sessão", () => {
    expect(authorizeRoute("/api/me", superAdmin).type).toBe("allow");
    expect(authorizeRoute("/api/me", aluno).type).toBe("allow");
  });

  it("papel desconhecido não passa em rota com papéis", () => {
    expect(authorizeRoute("/admin", { role: "ADMIN", tenantId: "t1" })).toEqual({
      type: "forbidden",
      home: null,
    });
  });
});

describe("findRouteRule", () => {
  it("regras públicas têm precedência", () => {
    expect(findRouteRule("/api/auth/callback/google")?.access).toBe("public");
  });
});

describe("matcher da proxy", () => {
  it("cobre todos os prefixos protegidos", () => {
    const source = readFileSync(path.join(process.cwd(), "src/proxy.ts"), "utf8");
    const matchers = [...source.matchAll(/"(\/[^"]*?)(\/:path\*)?"/g)].map((m) => m[1]);
    for (const prefix of PROTECTED_PREFIXES) {
      expect(
        matchers.some((m) => matchesPrefix(prefix, m)),
        `matcher sem ${prefix}`,
      ).toBe(true);
    }
  });
});

describe("safeCallbackPath", () => {
  it("aceita só caminhos internos", () => {
    expect(safeCallbackPath("/aluno?x=1")).toBe("/aluno?x=1");
    expect(safeCallbackPath("//evil.com")).toBeNull();
    expect(safeCallbackPath("/\\evil.com")).toBeNull();
    expect(safeCallbackPath("https://evil.com")).toBeNull();
    expect(safeCallbackPath(null)).toBeNull();
  });
});

describe("isNonMvpLevelPath", () => {
  it.each([
    ["/aluno/niveis/dashboard", true],
    ["/aluno/niveis/dashboard/exercicios/1", true],
    ["/aluno/niveis/xyz", true],
    ["/aluno/niveis/fundamental", false],
    ["/aluno/niveis/profissional/exercicios/2", false],
    ["/aluno/niveis/avancado/", false],
    ["/aluno/niveis/Fundamental", false],
    ["/aluno", false],
    ["/aluno/niveis", false],
    ["/professor/niveis/dashboard", false],
  ])("%s → %s", (path, expected) => {
    expect(isNonMvpLevelPath(path)).toBe(expected);
  });
});
