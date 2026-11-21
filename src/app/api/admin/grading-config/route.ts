import { gradingBandsSchema } from "@/lib/validation/grading";
import { authErrorResponse } from "@/server/auth/session";
import { requireTenant } from "@/server/auth/tenant";
import { getGradingBands, setGradingBands } from "@/server/grading/service";

const ROLES = ["INSTITUTION_ADMIN", "SUPER_ADMIN"] as const;

function requestedTenant(request: Request): string | null {
  return new URL(request.url).searchParams.get("tenantId");
}

/** GET — faixas de conceito vigentes (padrão 50/70/90). SUPER_ADMIN: ?tenantId=. */
export async function GET(request: Request) {
  try {
    const ctx = await requireTenant(ROLES, {
      headers: request.headers,
      requestedTenantId: requestedTenant(request),
    });
    return Response.json({ bands: await getGradingBands(ctx.db) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

/** PUT { edMinPercent, dMinPercent, pdMinPercent } — define as faixas da instituição. */
export async function PUT(request: Request) {
  let ctx;
  try {
    ctx = await requireTenant(ROLES, {
      headers: request.headers,
      requestedTenantId: requestedTenant(request),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
  const parsed = gradingBandsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const config = await setGradingBands(ctx, parsed.data);
  return Response.json({
    bands: {
      edMinPercent: config.edMinPercent,
      dMinPercent: config.dMinPercent,
      pdMinPercent: config.pdMinPercent,
    },
  });
}
