import { validationError } from "@/lib/api-error";
import { gradingBandsSchema } from "@/lib/validation/grading";
import { handleApiError } from "@/server/api-response";
import { requireRole } from "@/server/auth/session";
import { getGradingDefaults, setGradingDefaults } from "@/server/platform/grading-defaults";

/** GET — faixas padrão da plataforma { edMinPercent, dMinPercent, pdMinPercent }. */
export async function GET(request: Request) {
  try {
    await requireRole("SUPER_ADMIN", request.headers);
    return Response.json({ bands: await getGradingDefaults() });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT { edMinPercent, dMinPercent, pdMinPercent } — 0 < ND < ED < D ≤ 100
 * (limites ND→ED, ED→D, D→PD). Vale só para instituições NOVAS. Inválido → 422.
 */
export async function PUT(request: Request) {
  try {
    const { user } = await requireRole("SUPER_ADMIN", request.headers);
    const parsed = gradingBandsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    return Response.json({ bands: await setGradingDefaults(user.id, parsed.data) });
  } catch (error) {
    return handleApiError(error);
  }
}
