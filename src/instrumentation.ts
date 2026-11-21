/**
 * Executado uma vez quando o servidor Next.js inicia: falha cedo se a
 * configuração de ambiente for inválida (ver src/lib/env.ts).
 * Durante o `next build` a validação é pulada para o build não exigir segredos.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { validateServerEnv } = await import("@/lib/env");
  const env = validateServerEnv();
  for (const warning of env.warnings) console.warn(`[env] ${warning}`);
}
