import { NextResponse, type NextRequest } from "next/server";

import { API_ERROR_CODES, ApiError } from "@/lib/api-error";
import {
  authorizeRoute,
  findRouteRule,
  isApiPath,
  isNonMvpLevelPath,
  LOGIN_PATH,
} from "@/lib/authz/route-rules";
import { getSession } from "@/server/auth/session";

/**
 * Autorização por rota (TA-003). Valida a sessão no banco (runtime Node.js da
 * proxy no Next 16) e aplica ROUTE_RULES:
 * - anônimo em página protegida → redireciona para /login?callbackUrl=...
 * - anônimo em API protegida    → 401 JSON
 * - papel insuficiente          → 403 (JSON na API, texto na página)
 * O isolamento por instituição NÃO está na URL: route handlers e server actions
 * continuam obrigados a chamar requireTenant()/requireRole().
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Rotas públicas não pagam a consulta de sessão.
  const rule = findRouteRule(pathname);
  if (!rule || rule.access === "public") {
    return NextResponse.next();
  }

  const session = await getSession(request.headers);
  const decision = authorizeRoute(pathname, session?.user ?? null);

  if (decision.type === "allow") {
    // Níveis fora do MVP: 404 real (só depois de autorizar, para não vazar rotas).
    if (isNonMvpLevelPath(pathname)) {
      return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
    }
    return NextResponse.next();
  }

  if (decision.type === "unauthenticated") {
    if (isApiPath(pathname)) {
      return NextResponse.json(
        new ApiError(401, API_ERROR_CODES.UNAUTHENTICATED, "Não autenticado").toBody(),
        { status: 401 },
      );
    }
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isApiPath(pathname)) {
    return NextResponse.json(
      new ApiError(403, API_ERROR_CODES.FORBIDDEN, "Acesso negado").toBody(),
      { status: 403 },
    );
  }
  return new NextResponse("403 — Acesso negado", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  // Só as áreas protegidas; estáticos e /api/auth ficam de fora.
  matcher: [
    "/super-admin/:path*",
    "/api/super-admin/:path*",
    "/admin/:path*",
    "/professor/:path*",
    "/aluno/:path*",
    "/api/admin/:path*",
    "/api/professor/:path*",
    "/api/aluno/:path*",
    "/api/me",
  ],
};
