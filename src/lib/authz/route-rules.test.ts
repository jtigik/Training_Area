import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  authorizeRoute,
  findRouteRule,
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

  it("/super-admin só SUPER_ADMIN", () => {
    expect(authorizeRoute("/super-admin", superAdmin).type).toBe("allow");
    expect(authorizeRoute("/super-admin", instAdmin).type).toBe("forbidden");
    expect(authorizeRoute("/api/super-admin/tenants", aluno).type).toBe("forbidden");
  });

  it("/admin: INSTITUTION_ADMIN e SUPER_ADMIN", () => {
    expect(authorizeRoute("/admin/usuarios", instAdmin).type).toBe("allow");
    expect(authorizeRoute("/admin", superAdmin).type).toBe("allow");
    expect(authorizeRoute("/admin", professor).type).toBe("forbidden");
    expect(authorizeRoute("/api/admin/users/1/role", aluno).type).toBe("forbidden");
  });

  it("/professor: PROFESSOR e INSTITUTION_ADMIN", () => {
    expect(authorizeRoute("/professor", professor).type).toBe("allow");
    expect(authorizeRoute("/professor", instAdmin).type).toBe("allow");
    expect(authorizeRoute("/professor", aluno).type).toBe("forbidden");
    expect(authorizeRoute("/api/professor/resultados", aluno).type).toBe("forbidden");
  });

  it("/aluno: qualquer membro de instituição, não SUPER_ADMIN", () => {
    expect(authorizeRoute("/aluno", aluno).type).toBe("allow");
    expect(authorizeRoute("/aluno", professor).type).toBe("allow");
    expect(authorizeRoute("/aluno", superAdmin).type).toBe("forbidden");
    expect(authorizeRoute("/aluno", { role: "ALUNO", tenantId: null }).type).toBe("forbidden");
  });

  it("/api/me: qualquer sessão", () => {
    expect(authorizeRoute("/api/me", superAdmin).type).toBe("allow");
    expect(authorizeRoute("/api/me", aluno).type).toBe("allow");
  });

  it("papel desconhecido não passa em rota com papéis", () => {
    expect(authorizeRoute("/admin", { role: "ADMIN", tenantId: "t1" }).type).toBe("forbidden");
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
    for (const prefix of PROTECTED_PREFIXES) {
      expect(source, `matcher sem ${prefix}`).toMatch(new RegExp(`"${prefix}(/:path\\*)?"`));
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
