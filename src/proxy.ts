import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIES } from "@/lib/api/session";

/**
 * Optimistic route guard for the student area (TA-003). It only looks at the
 * session cookie; the API remains the real authorization check.
 *  - no session cookie            -> redirect to /login?voltar=<path>
 *  - mock session of another role -> 403 page (mock cookies carry the role:
 *    "mock.<ROLE>.<id>"; real Better Auth tokens are opaque, so in http mode
 *    the role check happens client-side in <StudentShell>).
 */
export function proxy(request: NextRequest) {
  const token = SESSION_COOKIES.map((name) => request.cookies.get(name)?.value).find(Boolean);
  const { pathname, search } = request.nextUrl;

  if (!token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("voltar", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const mockRole = /^mock\.([A-Z]+)\./.exec(token)?.[1];
  if (mockRole && mockRole !== "STUDENT") {
    return NextResponse.rewrite(new URL("/acesso-negado", request.url), { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/aluno", "/aluno/:path*"],
};
