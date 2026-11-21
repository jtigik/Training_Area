/**
 * Session cookie names checked (optimistically) by src/proxy.ts. Better Auth
 * (Backend 1) uses "better-auth.session_token", with the "__Secure-" prefix on HTTPS.
 * The real authorization check always happens in the API (TA-003).
 */
export const SESSION_COOKIE = "better-auth.session_token";
export const SESSION_COOKIES = [SESSION_COOKIE, `__Secure-${SESSION_COOKIE}`] as const;
