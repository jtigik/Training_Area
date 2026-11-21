import { isRole, type Role } from "@/lib/roles";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Nulo apenas para SUPER_ADMIN. */
  tenantId: string | null;
}

/** Sessão coerente? (papel válido; tenant presente exceto para SUPER_ADMIN). */
export function toSessionUser(user: {
  id: string;
  name: string;
  email: string;
  role?: unknown;
  tenantId?: unknown;
  active?: unknown;
}): SessionUser | null {
  if (user.active === false || !isRole(user.role)) return null;
  const tenantId = typeof user.tenantId === "string" && user.tenantId ? user.tenantId : null;
  if ((user.role === "SUPER_ADMIN") !== (tenantId === null)) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, tenantId };
}
