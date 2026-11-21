"use client";

import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ROLES } from "@/lib/roles";

/**
 * Cliente do Better Auth para componentes "use client" (FE1).
 * Lançamento: authClient.signIn.social({ provider: "google" | "microsoft", callbackURL: "/" }).
 * Dev/teste (AUTH_EMAIL_PASSWORD_ENABLED=true): authClient.signIn.email({ email, password }).
 * Sair: authClient.signOut().
 */
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: [...ROLES], required: false, input: false },
        tenantId: { type: "string", required: false, input: false },
        active: { type: "boolean", required: false, input: false },
      },
    }),
  ],
});
