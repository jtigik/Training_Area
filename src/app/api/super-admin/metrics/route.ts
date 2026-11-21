import { handleApiError } from "@/server/api-response";
import { requireRole } from "@/server/auth/session";
import { getPlatformMetrics } from "@/server/platform/metrics";

/** GET — números agregados por instituição (usuários por papel, tentativas, conceitos). */
export async function GET(request: Request) {
  try {
    await requireRole("SUPER_ADMIN", request.headers);
    return Response.json(await getPlatformMetrics());
  } catch (error) {
    return handleApiError(error);
  }
}
