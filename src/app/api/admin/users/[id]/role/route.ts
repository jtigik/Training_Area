import { validationError } from "@/lib/api-error";
import { updateRoleSchema } from "@/lib/validation/auth";
import { handleApiError } from "@/server/api-response";
import { requireTenant } from "@/server/auth/tenant";
import { changeUserRole } from "@/server/users/roles";

/**
 * PATCH { role } — altera o papel de um usuário da instituição (TA-002).
 * Só INSTITUTION_ADMIN, no próprio tenant. SUPER_ADMIN não vê nem altera
 * usuários dentro das instituições (só métricas agregadas — decisão do PO).
 * Erros: 404 NOT_FOUND, 409 LAST_ADMIN, 400 VALIDATION_ERROR.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[id]/role">) {
  try {
    const tenantCtx = await requireTenant(["INSTITUTION_ADMIN"], { headers: request.headers });
    const parsed = updateRoleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const { id } = await ctx.params;
    const user = await changeUserRole(tenantCtx, id, parsed.data.role);
    return Response.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
