import { validationError } from "@/lib/api-error";
import { invitationInputSchema } from "@/lib/validation/invitation";
import { handleApiError } from "@/server/api-response";
import { requireTenant } from "@/server/auth/tenant";
import { createInvitation } from "@/server/users/invitations";

/**
 * POST { email, role, expiresInDays?, tenantId? } — convida para a instituição
 * (e-mail único na plataforma). SUPER_ADMIN informa tenantId (ex.: primeiro
 * INSTITUTION_ADMIN). Erros: 409 EMAIL_IN_USE | PENDING_INVITATION, 400 VALIDATION_ERROR.
 */
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const requestedTenantId =
      body && typeof body === "object" && "tenantId" in body && typeof body.tenantId === "string"
        ? body.tenantId
        : null;
    const ctx = await requireTenant(["INSTITUTION_ADMIN", "SUPER_ADMIN"], {
      headers: request.headers,
      requestedTenantId,
    });
    const parsed = invitationInputSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues);
    return Response.json({ invitation: await createInvitation(ctx, parsed.data) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
