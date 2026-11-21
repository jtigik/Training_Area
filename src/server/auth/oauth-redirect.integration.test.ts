/**
 * Login social com e-mail não cadastrado → redireciona para
 * /login?error=ACCOUNT_NOT_REGISTERED (decisão do PO). Usa o provedor OAuth
 * falso do QA (e2e/support/mock-oauth.ts) e o handler real do Better Auth.
 * Roda só com RUN_DB_TESTS=1 (npm run test:db).
 */
import type { Server } from "node:http";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.RUN_DB_TESTS === "1";
const APP = "http://localhost:3999";
const MOCK_PORT = 3198;

describe.skipIf(!enabled)("callback OAuth com e-mail desconhecido", () => {
  let server: Server;
  let handler: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    process.env.AUTH_OAUTH_MOCK_BASE_URL = `http://localhost:${MOCK_PORT}`;
    process.env.BETTER_AUTH_URL = APP;
    process.env.BETTER_AUTH_SECRET ??= "test-only-secret-0123456789abcdef0123";
    const { startMockOAuth } = await import("../../../e2e/support/mock-oauth");
    server = await startMockOAuth(MOCK_PORT);
    handler = (await import("@/server/auth/auth")).auth.handler;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  async function socialLogin(email: string) {
    await fetch(`http://localhost:${MOCK_PORT}/__e2e/next`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "google", email }),
    });
    const start = await handler(
      new Request(`${APP}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: APP },
        body: JSON.stringify({ provider: "google", callbackURL: "/aluno" }),
      }),
    );
    const { url } = (await start.json()) as { url: string };
    const cookie = start.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const authorize = await fetch(url, { redirect: "manual" });
    const callbackUrl = authorize.headers.get("location")!;
    return handler(new Request(callbackUrl, { headers: { cookie } }));
  }

  it("redireciona para /login?error=ACCOUNT_NOT_REGISTERED (sem 403 JSON)", async () => {
    const res = await socialLogin("ninguem@desconhecido.example");
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!, APP);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("ACCOUNT_NOT_REGISTERED");
  });

  it("usuário cadastrado segue para o callbackURL", async () => {
    const res = await socialLogin("aluno@escola-demo.local");
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location")!, APP).pathname).toBe("/aluno");
  });
});
