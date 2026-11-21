import { validationError } from "@/lib/api-error";
import { conceptOverrideSchema } from "@/lib/validation/grading";
import { handleApiError } from "@/server/api-response";
import { requireTenant } from "@/server/auth/tenant";
import { overrideLevelConcept } from "@/server/grading/service";

/**
 * PATCH { concept, reason } — professor ajusta o conceito final com justificativa
 * (≥ 10 caracteres, registrada). Erros: 404 NOT_FOUND, 409 NOT_COMPLETED | SAME_CONCEPT.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/professor/level-attempts/[id]/concept">,
) {
  try {
    const tenantCtx = await requireTenant(["PROFESSOR"], {
      headers: request.headers,
    });
    const parsed = conceptOverrideSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const { id } = await ctx.params;
    return Response.json({ levelAttempt: await overrideLevelConcept(tenantCtx, id, parsed.data) });
  } catch (error) {
    return handleApiError(error);
  }
}
