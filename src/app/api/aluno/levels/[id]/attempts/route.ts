import { handleApiError } from "@/server/api-response";
import { requireTenant } from "@/server/auth/tenant";
import { startLevelAttempt } from "@/server/levels/start";

/**
 * POST — ALUNO inicia uma tentativa do nível (desbloqueio + refazer + cota +
 * sorteio congelado). 201 { levelAttempt, exercises } (sem gabarito).
 * 409 LEVEL_LOCKED | LEVEL_IN_PROGRESS | LEVEL_ALREADY_PASSED | LEVEL_AWAITING_GRADE |
 * LEVEL_NOT_AVAILABLE | EMPTY_POOL; 404 NOT_FOUND.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/aluno/levels/[id]/attempts">) {
  try {
    const tenantCtx = await requireTenant("ALUNO", { headers: request.headers });
    const { id } = await ctx.params;
    return Response.json(await startLevelAttempt(tenantCtx, id), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
