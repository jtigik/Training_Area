"use client";

import { customSessionClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ROLES } from "@/lib/roles";
import type { auth } from "@/server/auth/auth";

/**
 * Cliente do Better Auth para componentes "use client" (FE1).
 * Lançamento e E2E: authClient.signIn.social({ provider: "google" | "microsoft", callbackURL: "/" }).
 * O mesmo método vale no modo mock (AUTH_OAUTH_MOCK_BASE_URL): no Better Auth 1.7
 * o genericOAuth registra os provedores como sociais. Liste os botões com
 * GET /api/login-options (ou getLoginOptions() no servidor).
 * Dev/teste (AUTH_EMAIL_PASSWORD_ENABLED=true): authClient.signIn.email({ email, password }).
 * Sair: authClient.signOut().
 * Sessão: authClient.useSession() → data.user inclui role, tenantId e
 * tenant ({ id, name, slug } | null para SUPER_ADMIN).
 */
export type LoginProviderId = "google" | "microsoft";

/** Inicia o login social; funciona nos modos nativo e mock. */
export function signInWithProvider(provider: LoginProviderId, callbackURL = "/") {
  return authClient.signIn.social({ provider, callbackURL, errorCallbackURL: "/login" });
}

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: [...ROLES], required: false, input: false },
        tenantId: { type: "string", required: false, input: false },
        active: { type: "boolean", required: false, input: false },
      },
    }),
    customSessionClient<typeof auth>(),
  ],
});
