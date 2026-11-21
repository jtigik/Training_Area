import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, buildSecurityHeaders } from "./security-headers";

function asMap(headers: { key: string; value: string }[]) {
  return Object.fromEntries(headers.map((h) => [h.key, h.value]));
}

describe("buildSecurityHeaders", () => {
  it("inclui os headers básicos do TA-033", () => {
    const headers = asMap(buildSecurityHeaders({ isDev: false }));
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Content-Security-Policy"]).toBeDefined();
  });
});

describe("buildContentSecurityPolicy", () => {
  it("em produção não permite unsafe-eval e bloqueia framing", () => {
    const csp = buildContentSecurityPolicy({ isDev: false });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toMatch(
      /form-action 'self' https:\/\/accounts\.google\.com https:\/\/login\.microsoftonline\.com/,
    );
  });

  it("em dev permite unsafe-eval e websocket do HMR", () => {
    const csp = buildContentSecurityPolicy({ isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toMatch(/connect-src 'self' ws:/);
  });
});
