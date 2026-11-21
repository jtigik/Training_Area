import { updateRoleSchema } from "@/lib/validation/auth";
import { authErrorResponse } from "@/server/auth/session";
import { requireTenant } from "@/server/auth/tenant";
import { changeUserRole, RoleChangeError } from "@/server/users/roles";

/**
 * PATCH { role, tenantId? } — altera o papel de um usuário da instituição (TA-002).
 * INSTITUTION_ADMIN: só no próprio tenant. SUPER_ADMIN: informa tenantId.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[id]/role">) {
  const body: unknown = await request.json().catch(() => null);
  const requestedTenantId =
    body && typeof body === "object" && "tenantId" in body && typeof body.tenantId === "string"
      ? body.tenantId
      : null;

  let tenantId: string;
  try {
    ({ tenantId } = await requireTenant(["INSTITUTION_ADMIN", "SUPER_ADMIN"], {
      requestedTenantId,
      headers: request.headers,
    }));
  } catch (error) {
    return authErrorResponse(error);
  }

  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { id } = await ctx.params;
  try {
    const user = await changeUserRole(tenantId, id, parsed.data.role);
    return Response.json({ user });
  } catch (error) {
    if (error instanceof RoleChangeError) {
      const status = error.code === "NOT_FOUND" ? 404 : 409;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
