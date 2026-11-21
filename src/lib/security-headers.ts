/**
 * Headers HTTP de segurança aplicados a todas as rotas (TA-033).
 * Usado por next.config.ts; mantido em src/lib para ser testável.
 */

/** Endpoints de autorização OAuth para onde formulários de login podem redirecionar. */
export const OAUTH_FORM_ACTION_ORIGINS = [
  "https://accounts.google.com",
  "https://login.microsoftonline.com",
] as const;

export function buildContentSecurityPolicy({ isDev }: { isDev: boolean }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-inline' é necessário para os scripts inline do Next.js sem nonce;
    // 'unsafe-eval' só em dev (React Refresh / source maps).
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    // ws: só em dev, para o HMR.
    "connect-src": ["'self'", ...(isDev ? ["ws:"] : [])],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", ...OAUTH_FORM_ACTION_ORIGINS],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function buildSecurityHeaders({
  isDev,
}: {
  isDev: boolean;
}): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy({ isDev }) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
  ];
}
