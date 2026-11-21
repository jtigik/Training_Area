import { validationError } from "@/lib/api-error";
import { gradingBandsSchema } from "@/lib/validation/grading";
import { handleApiError } from "@/server/api-response";
import { requireTenant } from "@/server/auth/tenant";
import { getGradingBands, setGradingBands } from "@/server/grading/service";

/**
 * Faixas de conceito DA INSTITUIÇÃO — só INSTITUTION_ADMIN, tenant da sessão
 * (Q-S1). O padrão da plataforma fica em /api/super-admin/grading-defaults.
 */
function tenantCtx(request: Request) {
  return requireTenant("INSTITUTION_ADMIN", { headers: request.headers });
}

/** GET — faixas vigentes da instituição. */
export async function GET(request: Request) {
  try {
    const ctx = await tenantCtx(request);
    return Response.json({ bands: await getGradingBands(ctx.db) });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT { edMinPercent, dMinPercent, pdMinPercent } — 0 < ND < ED < D ≤ 100, ou seja
 * 0 < edMinPercent < dMinPercent < pdMinPercent ≤ 100. Inválido → 422 VALIDATION_ERROR.
 */
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
