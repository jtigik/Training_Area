import { handleApiError } from "@/server/api-response";
import { requireTenant } from "@/server/auth/tenant";
import { getConceptHistory } from "@/server/grading/service";

/**
 * GET — histórico de ajustes manuais do conceito da tentativa, ordenado do mais
 * antigo ao mais recente: { levelAttemptId, computedConcept, concept, history:
 * [{ id, previousConcept, newConcept, reason, author: { id, name } | null, createdAt }] }.
 * Só PROFESSOR, no próprio tenant; tentativa de outra instituição → 404 NOT_FOUND.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/professor/level-attempts/[id]/concept-history">,
) {
  try {
    const tenantCtx = await requireTenant("PROFESSOR", { headers: request.headers });
    const { id } = await ctx.params;
    return Response.json(await getConceptHistory(tenantCtx.db, id));
  } catch (error) {
    return handleApiError(error);
  }
}
