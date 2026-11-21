import { authErrorResponse, requireSession } from "@/server/auth/session";
import { getTenantSummary } from "@/server/auth/tenant-summary";

/**
 * GET — usuário da sessão atual. 401 sem sessão.
 * { user: { id, name, email, role, tenantId, tenant: { id, name, slug } | null } }
 * tenant é null só para SUPER_ADMIN.
 */
export async function GET(request: Request) {
  try {
    const { user } = await requireSession(request.headers);
    return Response.json({ user: { ...user, tenant: await getTenantSummary(user.tenantId) } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
