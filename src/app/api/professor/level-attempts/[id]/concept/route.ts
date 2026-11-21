import { conceptOverrideSchema } from "@/lib/validation/grading";
import { authErrorResponse } from "@/server/auth/session";
import { requireTenant } from "@/server/auth/tenant";
import { GradingError, overrideLevelConcept } from "@/server/grading/service";

/** PATCH { concept, reason } — professor ajusta o conceito final com justificativa. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/professor/level-attempts/[id]/concept">,
) {
  let tenantCtx;
  try {
    tenantCtx = await requireTenant(["PROFESSOR", "INSTITUTION_ADMIN"], {
      headers: request.headers,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
  const parsed = conceptOverrideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { id } = await ctx.params;
  try {
    const attempt = await overrideLevelConcept(tenantCtx, id, parsed.data);
    return Response.json({ levelAttempt: attempt });
  } catch (error) {
    if (error instanceof GradingError) {
      const status = error.code === "NOT_FOUND" ? 404 : 409;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
