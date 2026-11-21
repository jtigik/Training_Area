import { validationError } from "@/lib/api-error";
import { gradingBandsSchema } from "@/lib/validation/grading";
import { handleApiError } from "@/server/api-response";
import { requireTenant } from "@/server/auth/tenant";
import { getGradingBands, setGradingBands } from "@/server/grading/service";

const ROLES = ["INSTITUTION_ADMIN", "SUPER_ADMIN"] as const;

function tenantCtx(request: Request) {
  return requireTenant(ROLES, {
    headers: request.headers,
    requestedTenantId: new URL(request.url).searchParams.get("tenantId"),
  });
}

/** GET — faixas de conceito vigentes (padrão 50/70/90). SUPER_ADMIN: ?tenantId=. */
export async function GET(request: Request) {
  try {
    const ctx = await tenantCtx(request);
    return Response.json({ bands: await getGradingBands(ctx.db) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PUT { edMinPercent, dMinPercent, pdMinPercent } — define as faixas da instituição. */
export async function PUT(request: Request) {
  try {
    const ctx = await tenantCtx(request);
    const parsed = gradingBandsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const config = await setGradingBands(ctx, parsed.data);
    return Response.json({
      bands: {
        edMinPercent: config.edMinPercent,
        dMinPercent: config.dMinPercent,
        pdMinPercent: config.pdMinPercent,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
