import { authErrorResponse } from "@/server/auth/session";
import { requireTenant } from "@/server/auth/tenant";
import { listApprovedFeedbackForStudent } from "@/server/feedback/student";

/** GET — feedbacks APROVADOS do aluno logado (nunca rascunhos/rejeitados). */
export async function GET(request: Request) {
  try {
    const ctx = await requireTenant("ALUNO", { headers: request.headers });
    const feedbacks = await listApprovedFeedbackForStudent(ctx);
    return Response.json({ feedbacks });
  } catch (error) {
    return authErrorResponse(error);
  }
}
