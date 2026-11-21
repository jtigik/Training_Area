import "server-only";

import { headers } from "next/headers";

import type { Role } from "@/lib/roles";
import { auth } from "@/server/auth/auth";
import { toSessionUser, type SessionUser } from "@/server/auth/session-user";

export type { SessionUser };

export interface AppSession {
  sessionId: string;
  user: SessionUser;
}

export class AuthError extends Error {
  constructor(
    readonly status: 400 | 401 | 403,
    message: string = status === 401 ? "Não autenticado" : "Acesso negado",
    readonly code?: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Lê e valida a sessão no banco. `null` se ausente, expirada ou incoerente. */
export async function getSession(requestHeaders?: Headers): Promise<AppSession | null> {
  const result = await auth.api.getSession({ headers: requestHeaders ?? (await headers()) });
  if (!result) return null;
  const user = toSessionUser(result.user);
  return user ? { sessionId: result.session.id, user } : null;
}

/** Exige sessão válida; AuthError(401) caso contrário. */
export async function requireSession(requestHeaders?: Headers): Promise<AppSession> {
  const session = await getSession(requestHeaders);
  if (!session) throw new AuthError(401);
  return session;
}

/**
 * Exige um dos papéis; 401 sem sessão, 403 com papel insuficiente.
 * Para dados de instituição use requireTenant() (src/server/auth/tenant.ts),
 * que também resolve o tenant.
 */
export async function requireRole(
  allowed: Role | readonly Role[],
  requestHeaders?: Headers,
): Promise<AppSession> {
  const session = await requireSession(requestHeaders);
  const roles: readonly Role[] = typeof allowed === "string" ? [allowed] : allowed;
  if (!roles.includes(session.user.role)) throw new AuthError(403);
  return session;
}

/** Converte AuthError em resposta JSON; repassa outros erros. */
export function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  throw error;
}
