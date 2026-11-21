/**
 * Mock-mode session cookie. Better Auth (Backend 1) names it
 * "better-auth.session_token" (with the "__Secure-" prefix on HTTPS) and sets it
 * httpOnly. Never read it by name in server/proxy code: use getSessionCookie()
 * from "better-auth/cookies", which handles the prefix.
 */
export const MOCK_SESSION_COOKIE = "better-auth.session_token";
