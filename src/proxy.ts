import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { LEVEL_SLUGS } from "@/lib/api/types";

const MVP_LEVEL_SLUGS = new Set(Object.values(LEVEL_SLUGS));

/**
 * Optimistic route guard for the student area (TA-003). It only looks at the
 * session cookie (via Better Auth's getSessionCookie, which handles the
 * "__Secure-" prefix); the API remains the real authorization check.
 *  - no session cookie            -> redirect to /login?callbackUrl=<path> (as Backend 1's proxy)
 *  - mock session of another role -> 403 page (mock cookies carry the role:
 *    "mock.<ROLE>.<id>"; real Better Auth tokens are opaque, so in http mode
 *    the role check happens client-side in <StudentShell>)
 *  - level routes outside the MVP (e.g. /aluno/niveis/dashboard/feedback) -> 404 (QA dashboard-v11)
 */
export function proxy(request: NextRequest) {
  const token = getSessionCookie(request);
  const { pathname, search } = request.nextUrl;

  if (!token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const mockRole = /^mock\.([A-Z_]+)\./.exec(token)?.[1];
  if (mockRole && mockRole !== "ALUNO") {
    return NextResponse.rewrite(new URL("/acesso-negado", request.url), { status: 403 });
  }

  const level = /^\/aluno\/niveis\/([^/]+)/.exec(pathname)?.[1];
  if (level !== undefined && !MVP_LEVEL_SLUGS.has(decodeURIComponent(level))) {
    // Rewrite to a path no route matches: Next renders the not-found page with HTTP 404.
    return NextResponse.rewrite(new URL("/nivel-inexistente", request.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/aluno", "/aluno/:path*"],
};
