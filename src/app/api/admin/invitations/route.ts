import { validationError } from "@/lib/api-error";
import { invitationInputSchema } from "@/lib/validation/invitation";
import { handleApiError } from "@/server/api-response";
import { requireTenant } from "@/server/auth/tenant";
import { createInvitation } from "@/server/users/invitations";

/**
 * POST { email, role, expiresInDays?, tenantId? } — convida para a instituição
 * (e-mail único na plataforma). SUPER_ADMIN informa tenantId (ex.: primeiro
 * INSTITUTION_ADMIN). 201 = novo; 200 = substituiu o convite pendente desta
 * instituição (novo id e validade; `renewed: true`). Erros: 409 EMAIL_IN_USE (conta
 * ativa) | USER_INACTIVE | PENDING_INVITATION (outra instituição), 422 VALIDATION_ERROR.
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
    const { invitation, renewed } = await createInvitation(ctx, parsed.data);
    return Response.json({ invitation, renewed }, { status: renewed ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
