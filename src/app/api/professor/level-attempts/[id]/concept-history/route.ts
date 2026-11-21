import { handleApiError } from "@/server/api-response";
import { requireTenant } from "@/server/auth/tenant";
import { getConceptHistory } from "@/server/grading/service";

/**
 * GET — histórico de ajustes manuais do conceito, do mais antigo ao mais recente:
 * 200 { history: [{ previousConcept, concept, computedConcept, reason,
 *   adjustedBy: { id, name }, adjustedAt (ISO) }] } — vazio: { history: [] }.
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
