import { validationError } from "@/lib/api-error";
import { tenantCreateSchema } from "@/lib/validation/tenant";
import { handleApiError } from "@/server/api-response";
import { requireRole } from "@/server/auth/session";
import { createTenant, listTenants } from "@/server/platform/tenants";

/** GET — instituições (sem dados de pessoas). */
export async function GET(request: Request) {
  try {
    await requireRole("SUPER_ADMIN", request.headers);
    return Response.json({ tenants: await listTenants() });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST { name, slug, emailDomains?, autoJoinByDomain? (false), locale? } — 409 SLUG_IN_USE. */
export async function POST(request: Request) {
  try {
    await requireRole("SUPER_ADMIN", request.headers);
    const parsed = tenantCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    return Response.json({ tenant: await createTenant(parsed.data) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
