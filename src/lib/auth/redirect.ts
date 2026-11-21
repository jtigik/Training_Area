import { ROLE_HOME, ROLE_PREFIXES, type Role } from "@/lib/api/types";

/** Reads the post-login target: `callbackUrl` (Backend 1's proxy) or the legacy `voltar`. */
export function callbackTarget(params: { get(name: string): string | null }): string | null {
  return params.get("callbackUrl") ?? params.get("voltar");
}

/** True for a same-origin absolute path ("/x"), rejecting "//host", "/\\host" and schemes. */
export function isSafePath(target: string): boolean {
  return (
    target.startsWith("/") &&
    !target.startsWith("//") &&
    !target.includes("\\") &&
    !/[\u0000-\u001f]/.test(target)
  );
}

/**
 * Where to send a user after login: the `callbackUrl` target when it is a safe,
 * same-origin path the role may access; otherwise the role's home.
 */
export function postLoginPath(role: Role, target: string | null | undefined): string {
  if (target && isSafePath(target)) {
    const path = target.split(/[?#]/)[0];
    if (ROLE_PREFIXES[role].some((p) => path === p || path.startsWith(`${p}/`))) return target;
  }
  return ROLE_HOME[role];
}
