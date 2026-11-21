/**
 * Remembers (client-side, non-sensitive) that this browser had a signed-in session,
 * so a later 401 can say "sessão expirada" only when there really was a session.
 * The session cookie itself is httpOnly and never read here.
 */
const KEY = "ta.hadSession";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function markSignedIn(): void {
  storage()?.setItem(KEY, "1");
}

export function clearSessionMarker(): void {
  storage()?.removeItem(KEY);
}

/**
 * Whether this browser had a session that was not ended by logout. Not cleared on read:
 * several resources can 401 at once and must all build the same login URL.
 */
export function hadSession(): boolean {
  return storage()?.getItem(KEY) === "1";
}

/** Login URL for a 401: adds motivo=sessao-expirada only when there was a prior session. */
export function loginRedirectPath(pathname: string | null, hadSession: boolean): string {
  const callbackUrl = encodeURIComponent(pathname || "/aluno");
  return hadSession
    ? `/login?motivo=sessao-expirada&callbackUrl=${callbackUrl}`
    : `/login?callbackUrl=${callbackUrl}`;
}
