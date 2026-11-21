/**
 * Provedor OAuth 2.0 / OIDC falso para Google e Microsoft nos e2e.
 *
 * Contrato do app (Backend 1): com AUTH_OAUTH_MOCK_BASE_URL=http://localhost:3199 o app usa
 * genericOAuth com {base}/<p>/authorize, {base}/<p>/token e {base}/<p>/userinfo, e o
 * callback é /api/auth/oauth2/callback/<p>. O perfil vem do USERINFO (o id_token é extra).
 *
 * Endpoints por provedor (`/google` e `/microsoft`):
 *   GET  /<p>/.well-known/openid-configuration
 *   GET  /<p>/authorize   → redireciona para redirect_uri com ?code=…&state=…
 *                           (ou ?error=access_denied quando o teste escolhe "negar")
 *   POST /<p>/token       → { access_token, id_token (RS256), token_type }
 *   GET  /<p>/userinfo    → { sub, email, name, email_verified }
 *   GET  /<p>/jwks        → chave pública
 *
 * Qual conta "entra" é decidido pelo teste, sem UI do provedor:
 *   - parâmetro `login_hint` do authorize, ou
 *   - `POST /__e2e/next` com { provider, email, deny? } (vale para o próximo authorize).
 */
import { createSign, generateKeyPairSync, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";

type Provider = "google" | "microsoft";
interface NextLogin {
  email: string;
  name?: string;
  deny?: boolean;
}

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "e2e-key";
const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

function signJwt(payload: Record<string, unknown>) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: KID }));
  const body = b64url(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${body}`);
  return `${header}.${body}.${b64url(signer.sign(privateKey))}`;
}

export function startMockOAuth(port: number): Promise<Server> {
  const base = `http://localhost:${port}`;
  const next = new Map<Provider, NextLogin>();
  const codes = new Map<
    string,
    { provider: Provider; email: string; name: string; nonce?: string; clientId: string }
  >();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", base);
    const json = (status: number, data: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };
    const readBody = async () => {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      return raw;
    };

    if (url.pathname === "/__e2e/next" && req.method === "POST") {
      const body = JSON.parse(await readBody()) as NextLogin & { provider: Provider };
      next.set(body.provider, body);
      return json(200, { ok: true });
    }

    const [, provider, ...rest] = url.pathname.split("/") as [string, Provider, ...string[]];
    if (provider !== "google" && provider !== "microsoft") return json(404, { error: "not_found" });
    const issuer = `${base}/${provider}`;
    const path = rest.join("/");

    if (path === ".well-known/openid-configuration") {
      return json(200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        userinfo_endpoint: `${issuer}/userinfo`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        scopes_supported: ["openid", "email", "profile"],
        token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
      });
    }
    if (path === "jwks") {
      return json(200, {
        keys: [{ ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" }],
      });
    }
    if (path === "authorize") {
      const redirect = new URL(url.searchParams.get("redirect_uri") ?? "");
      const state = url.searchParams.get("state");
      if (state) redirect.searchParams.set("state", state);
      const chosen = next.get(provider) ?? { email: url.searchParams.get("login_hint") ?? "" };
      next.delete(provider);
      if (chosen.deny || !chosen.email) {
        redirect.searchParams.set("error", "access_denied");
      } else {
        const code = randomUUID();
        codes.set(code, {
          provider,
          email: chosen.email,
          name: chosen.name ?? chosen.email.split("@")[0],
          nonce: url.searchParams.get("nonce") ?? undefined,
          clientId: url.searchParams.get("client_id") ?? "",
        });
        redirect.searchParams.set("code", code);
      }
      res.writeHead(302, { location: redirect.toString() });
      return res.end();
    }
    if (path === "token" && req.method === "POST") {
      const raw = await readBody();
      const params = (req.headers["content-type"] ?? "").includes("application/json")
        ? new URLSearchParams(JSON.parse(raw) as Record<string, string>)
        : new URLSearchParams(raw);
      const grant = codes.get(params.get("code") ?? "");
      if (!grant) return json(400, { error: "invalid_grant" });
      codes.delete(params.get("code")!);
      const now = Math.floor(Date.now() / 1000);
      const idToken = signJwt({
        iss: issuer,
        aud: grant.clientId || params.get("client_id"),
        sub: `e2e-${grant.email}`,
        email: grant.email,
        email_verified: true,
        name: grant.name,
        nonce: grant.nonce,
        iat: now,
        exp: now + 600,
      });
      return json(200, {
        access_token: b64url(JSON.stringify({ email: grant.email, name: grant.name })),
        id_token: idToken,
        token_type: "Bearer",
        expires_in: 600,
        scope: "openid email profile",
      });
    }
    if (path === "userinfo") {
      const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      try {
        const { email, name } = JSON.parse(Buffer.from(token, "base64url").toString());
        return json(200, { sub: `e2e-${email}`, email, name, email_verified: true });
      } catch {
        return json(401, { error: "invalid_token" });
      }
    }
    return json(404, { error: "not_found" });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve(server));
  });
}

/** Define a conta que o próximo /authorize do provedor vai "logar" (ou negar). */
export async function setNextOAuthLogin(
  mockUrl: string,
  provider: Provider,
  login: NextLogin,
): Promise<void> {
  const res = await fetch(`${mockUrl}/__e2e/next`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider, ...login }),
  });
  if (!res.ok) throw new Error(`mock OAuth respondeu ${res.status}`);
}
