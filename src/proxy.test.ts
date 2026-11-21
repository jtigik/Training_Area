import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const req = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "http://localhost:3101"), {
    headers: cookie ? { cookie } : {},
  });

describe("proxy (student area guard)", () => {
  it("redirects anonymous users to /login?callbackUrl=", () => {
    const res = proxy(req("/aluno/conteudo?nivel=fundamental"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3101/login?callbackUrl=%2Faluno%2Fconteudo%3Fnivel%3Dfundamental",
    );
  });

  it("finds the session cookie with or without the __Secure- prefix", () => {
    expect(proxy(req("/aluno", "better-auth.session_token=abc")).status).toBe(200);
    expect(proxy(req("/aluno", "__Secure-better-auth.session_token=abc")).status).toBe(200);
  });

  it("answers 403 for mock sessions of other roles", () => {
    expect(proxy(req("/aluno", "better-auth.session_token=mock.PROFESSOR.u")).status).toBe(403);
  });

  it("answers 404 for level routes outside the MVP (Dashboard is v1.1)", () => {
    const cookie = "better-auth.session_token=mock.ALUNO.u";
    expect(proxy(req("/aluno/niveis/dashboard/feedback", cookie)).status).toBe(404);
    expect(proxy(req("/aluno/niveis/fundamental/feedback", cookie)).status).toBe(200);
  });
});
