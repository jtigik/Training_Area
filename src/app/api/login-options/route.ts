import { connection } from "next/server";

import { getLoginOptions } from "@/server/auth/login-options";

/**
 * GET (público) — provedores de login habilitados e se o formulário de senha
 * (dev/teste) aparece. Ex.: { providers: [{ id: "google", label: "Google" }], emailPassword: false, oauthMode: "native" }.
 */
export async function GET() {
  await connection(); // lê variáveis em tempo de execução, não no build
  return Response.json(getLoginOptions());
}
