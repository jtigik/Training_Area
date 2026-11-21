import { validationError } from "@/lib/api-error";
import { tenantUpdateSchema } from "@/lib/validation/tenant";
import { handleApiError } from "@/server/api-response";
import { requireRole } from "@/server/auth/session";
import { updateTenant } from "@/server/platform/tenants";

/** PATCH { name?, slug?, emailDomains?, autoJoinByDomain?, locale?, active? } — 404/409. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/super-admin/tenants/[id]">) {
  try {
    await requireRole("SUPER_ADMIN", request.headers);
    const parsed = tenantUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const { id } = await ctx.params;
    return Response.json({ tenant: await updateTenant(id, parsed.data) });
  } catch (error) {
    return handleApiError(error);
  }
}
