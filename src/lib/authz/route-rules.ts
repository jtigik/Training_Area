import { isRole, ROLE_HOME, type Role } from "@/lib/roles";

/**
 * Regras de autorização por rota (TA-003). Arquivo puro e testável; usado por
 * src/proxy.ts. A proxy é só a primeira barreira: route handlers e server
 * actions DEVEM revalidar com requireRole()/requireTenant()
 * (src/server/auth/session.ts e tenant.ts) — inclusive o isolamento por tenant,
 * que não aparece na URL.
 *
 * Áreas por papel (decisão do PO, 21/11 03:26): cada área é exclusiva de um
 * papel — /aluno → ALUNO, /professor → PROFESSOR, /admin → INSTITUTION_ADMIN,
 * /super-admin → SUPER_ADMIN (páginas e /api/<área>). PROFESSOR não tem
 * "modo prévia" do aluno no MVP. Exceções explícitas (SUPER_ADMIN agindo numa
 * instituição) vêm ANTES do prefixo da área.
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

  // Exceções: SUPER_ADMIN configura faixas e convida o 1º admin de uma
  // instituição (informando tenantId). Os handlers revalidam com requireTenant.
  { prefix: "/api/admin/grading-config", access: ["INSTITUTION_ADMIN", "SUPER_ADMIN"] },
  { prefix: "/api/admin/invitations", access: ["INSTITUTION_ADMIN", "SUPER_ADMIN"] },

  { prefix: "/admin", access: ["INSTITUTION_ADMIN"] },
  { prefix: "/api/admin", access: ["INSTITUTION_ADMIN"] },

  { prefix: "/professor", access: ["PROFESSOR"] },
  { prefix: "/api/professor", access: ["PROFESSOR"] },

  { prefix: "/aluno", access: ["ALUNO"] },
  { prefix: "/api/aluno", access: ["ALUNO"] },

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

export type AuthzDecision =
  | { type: "allow" }
  | { type: "unauthenticated" }
  /** `home`: área do próprio papel (páginas redirecionam para lá; API responde 403). */
  | { type: "forbidden"; home: string | null };

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
  const forbidden = { type: "forbidden", home: homeForRole(user.role) } as const;
  if (rule.access === "tenant-member") {
    return user.tenantId && user.role !== "SUPER_ADMIN" ? { type: "allow" } : forbidden;
  }
  if (!(rule.access as readonly unknown[]).includes(user.role)) return forbidden;
  // Papel de instituição sem instituição (dado inconsistente) não entra.
  if (user.role !== "SUPER_ADMIN" && user.tenantId === null) return forbidden;
  return { type: "allow" };
}

/** Página inicial do papel, ou null para papel desconhecido. */
export function homeForRole(role: unknown): string | null {
  return isRole(role) ? ROLE_HOME[role] : null;
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

/** Slugs de nível navegáveis no MVP (DASHBOARD fica para a v1.1). */
export const MVP_LEVEL_SLUGS = ["fundamental", "profissional", "avancado"] as const;

/**
 * true para /aluno/niveis/:nivel[/...] quando :nivel não é um nível do MVP.
 * A proxy responde 404 real (o notFound() no layout chega tarde com Cache
 * Components e o status sai 200).
 */
export function isNonMvpLevelPath(pathname: string): boolean {
  const match = /^\/aluno\/niveis\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!match) return false;
  let slug: string;
  try {
    slug = decodeURIComponent(match[1]).toLowerCase();
  } catch {
    return true;
  }
  return !(MVP_LEVEL_SLUGS as readonly string[]).includes(slug);
}
