import { handleApiError } from "@/server/api-response";
import { requireTenant } from "@/server/auth/tenant";
import { getSetProgress } from "@/server/levels/start";

/** GET — níveis do conjunto com { unlocked, passed, lastConcept, requires, start } do aluno. */
export async function GET(request: Request, ctx: RouteContext<"/api/aluno/sets/[id]/progress">) {
  try {
    const { db, user } = await requireTenant("ALUNO", { headers: request.headers });
    const { id } = await ctx.params;
    return Response.json({ levels: await getSetProgress(db, user.id, id) });
  } catch (error) {
    return handleApiError(error);
  }
}
