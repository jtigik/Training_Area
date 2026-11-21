import { invitationInputSchema } from "@/lib/validation/invitation";
import { authErrorResponse } from "@/server/auth/session";
import { requireTenant } from "@/server/auth/tenant";
import { createInvitation, InvitationError } from "@/server/users/invitations";

/** POST { email, role, expiresInDays?, tenantId? } — convida para a instituição (e-mail único na plataforma). */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const requestedTenantId =
    body && typeof body === "object" && "tenantId" in body && typeof body.tenantId === "string"
      ? body.tenantId
      : null;
  let ctx;
  try {
    ctx = await requireTenant(["INSTITUTION_ADMIN", "SUPER_ADMIN"], {
      headers: request.headers,
      requestedTenantId,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
  const parsed = invitationInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    return Response.json({ invitation: await createInvitation(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    if (error instanceof InvitationError) {
      return Response.json({ error: error.message, code: error.code }, { status: 409 });
    }
    throw error;
  }
}
