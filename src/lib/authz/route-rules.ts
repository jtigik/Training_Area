import { type Role } from "@/lib/roles";

/**
 * Regras de autorização por rota (TA-003). Arquivo puro e testável; usado por
 * src/proxy.ts. A proxy é só a primeira barreira: route handlers e server
 * actions DEVEM revalidar com requireRole()/requireTenant()
 * (src/server/auth/session.ts e tenant.ts) — inclusive o isolamento por tenant,
 * que não aparece na URL.
 *
 * Avaliadas em ordem; a primeira que casar vence. Sem regra = público.
 *  - "public": qualquer um
 *  - "authenticated": qualquer sessão válida
 *  - "tenant-member": sessão de usuário com instituição (não SUPER_ADMIN)
 *  - Role[]: papéis permitidos
 */
export type RouteAccess = "public" | "authenticated" | "tenant-member" | readonly Role[];

export interface RouteRule {
  /** Prefixo casado por segmento ("/admin" casa "/admin" e "/admin/x", não "/administrar"). */
  prefix: string;
  access: RouteAccess;
}

export const ROUTE_RULES: readonly RouteRule[] = [
  { prefix: "/api/auth", access: "public" },
  { prefix: "/api/health", access: "public" },
  { prefix: "/login", access: "public" },

  { prefix: "/super-admin", access: ["SUPER_ADMIN"] },
  { prefix: "/api/super-admin", access: ["SUPER_ADMIN"] },

  { prefix: "/admin", access: ["INSTITUTION_ADMIN", "SUPER_ADMIN"] },
  { prefix: "/api/admin", access: ["INSTITUTION_ADMIN", "SUPER_ADMIN"] },

  { prefix: "/professor", access: ["PROFESSOR", "INSTITUTION_ADMIN"] },
  { prefix: "/api/professor", access: ["PROFESSOR", "INSTITUTION_ADMIN"] },

  { prefix: "/aluno", access: "tenant-member" },
  { prefix: "/api/aluno", access: "tenant-member" },

  { prefix: "/api/me", access: "authenticated" },
];

/**
 * Prefixos que a proxy precisa interceptar. Mantido em sincronia com
 * `config.matcher` de src/proxy.ts (teste em route-rules.test.ts).
 */
export const PROTECTED_PREFIXES = ROUTE_RULES.filter((r) => r.access !== "public").map(
  (r) => r.prefix,
);

export const LOGIN_PATH = "/login";

export function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function findRouteRule(
  pathname: string,
  rules: readonly RouteRule[] = ROUTE_RULES,
): RouteRule | undefined {
  return rules.find((rule) => matchesPrefix(pathname, rule.prefix));
}

export type AuthzDecision = { type: "allow" } | { type: "unauthenticated" } | { type: "forbidden" };

export interface AuthzSubject {
  role: unknown;
  tenantId?: string | null;
  active?: boolean | null;
}

/** Decide o acesso a `pathname` para o usuário da sessão (ou `null` se anônimo). */
export function authorizeRoute(
  pathname: string,
  user: AuthzSubject | null,
  rules: readonly RouteRule[] = ROUTE_RULES,
): AuthzDecision {
  const rule = findRouteRule(pathname, rules);
  if (!rule || rule.access === "public") return { type: "allow" };

  // Usuário desativado é tratado como anônimo (TA-006).
  if (!user || user.active === false) return { type: "unauthenticated" };
  if (rule.access === "authenticated") return { type: "allow" };
  if (rule.access === "tenant-member") {
    return user.tenantId && user.role !== "SUPER_ADMIN" ? { type: "allow" } : { type: "forbidden" };
  }

  return (rule.access as readonly unknown[]).includes(user.role)
    ? { type: "allow" }
    : { type: "forbidden" };
}

export function isApiPath(pathname: string): boolean {
  return matchesPrefix(pathname, "/api");
}

/** Só aceita destino relativo interno, para evitar open redirect no callbackURL. */
export function safeCallbackPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  return value;
}
