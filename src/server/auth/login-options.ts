import "server-only";

import { loginOptionsFrom, readAuthEnv, type LoginOptions } from "@/server/auth/config";

/** Provedores de login habilitados (para server components da tela de login). */
export function getLoginOptions(): LoginOptions {
  return loginOptionsFrom(readAuthEnv());
}
