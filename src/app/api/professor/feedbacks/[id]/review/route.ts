import { validationError } from "@/lib/api-error";
import { feedbackReviewSchema } from "@/lib/validation/feedback";
import { handleApiError } from "@/server/api-response";
import { requireTenant } from "@/server/auth/tenant";
import { reviewFeedback } from "@/server/feedback/professor";

/**
 * POST { action: "approve" } | { action: "reject", reason } — revisão do feedback.
 * Erros: 404, 409 ALREADY_REVIEWED | NO_TEXT, 422 VALIDATION_ERROR. Auditado.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/professor/feedbacks/[id]/review">,
) {
  try {
    const tenantCtx = await requireTenant("PROFESSOR", { headers: request.headers });
    const parsed = feedbackReviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const { id } = await ctx.params;
    return Response.json({ feedback: await reviewFeedback(tenantCtx, id, parsed.data) });
  } catch (error) {
    return handleApiError(error);
  }
}
