import { ROLE_HOME, ROLE_PREFIXES, type Role } from "@/lib/api/types";

/**
 * Where to send a user after login: the `?voltar=` target when it is a safe,
 * same-origin path the role may access; otherwise the role's home.
 */
export function postLoginPath(role: Role, voltar: string | null | undefined): string {
  if (voltar && voltar.startsWith("/") && !voltar.startsWith("//") && !voltar.includes("\\")) {
    const path = voltar.split(/[?#]/)[0];
    if (ROLE_PREFIXES[role].some((p) => path === p || path.startsWith(`${p}/`))) return voltar;
  }
  return ROLE_HOME[role];
}
