import { validationError } from "@/lib/api-error";
import { feedbackEditSchema } from "@/lib/validation/feedback";
import { handleApiError } from "@/server/api-response";
import { requireTenant } from "@/server/auth/tenant";
import { editFeedback, getFeedbackForProfessor } from "@/server/feedback/professor";

/**
 * GET — feedback para revisão: { feedback: { ai, edited, final, status, ... } }.
 * `ai` = originais imutáveis; `edited` = edição do professor (null = sem edição);
 * `final` = o que o aluno verá ao aprovar. Outra instituição → 404.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/professor/feedbacks/[id]">) {
  try {
    const tenantCtx = await requireTenant("PROFESSOR", { headers: request.headers });
    const { id } = await ctx.params;
    return Response.json({ feedback: await getFeedbackForProfessor(tenantCtx, id) });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH { text?, strengths?, toReview? } — edição separada (null = descarta a edição).
 * Erros: 404, 409 NOT_EDITABLE (aprovado), 422 VALIDATION_ERROR. Auditado.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/professor/feedbacks/[id]">) {
  try {
    const tenantCtx = await requireTenant("PROFESSOR", { headers: request.headers });
    const parsed = feedbackEditSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const { id } = await ctx.params;
    return Response.json({ feedback: await editFeedback(tenantCtx, id, parsed.data) });
  } catch (error) {
    return handleApiError(error);
  }
}
