import { validationError } from "@/lib/api-error";
import { userUpdateSchema } from "@/lib/validation/user";
import { handleApiError } from "@/server/api-response";
import { requireTenant } from "@/server/auth/tenant";
import { updateTenantUser } from "@/server/users/update";

/**
 * PATCH { name?, email?, active? } — INSTITUTION_ADMIN edita um usuário da própria
 * instituição (papel: PATCH /api/admin/users/:id/role). 200 { user, changed }.
 * Erros: 404 NOT_FOUND (outro tenant), 409 EMAIL_TAKEN, 422 CANNOT_DEACTIVATE_SELF |
 * VALIDATION_ERROR (corpo vazio, campo inválido ou não permitido).
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  try {
    const tenantCtx = await requireTenant("INSTITUTION_ADMIN", { headers: request.headers });
    const parsed = userUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const { id } = await ctx.params;
    return Response.json(await updateTenantUser(tenantCtx, id, parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}
