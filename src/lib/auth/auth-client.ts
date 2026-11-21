"use client";

import { createAuthClient } from "better-auth/react";
import type { AuthProvider } from "@/lib/api/types";

/**
 * Better Auth client (Backend 1 mounts it at /api/auth). Mirrors the API of
 * Backend 1's src/lib/auth-client.ts (signInWithProvider) without depending on
 * their branch. Only used in http mode (NEXT_PUBLIC_API_MODE=http).
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || undefined,
});

/** POST /api/auth/sign-in/social { provider, callbackURL } -> { url, redirect }. */
export function signInWithProvider(provider: AuthProvider, callbackURL = "/") {
  return authClient.signIn.social({ provider, callbackURL });
}
