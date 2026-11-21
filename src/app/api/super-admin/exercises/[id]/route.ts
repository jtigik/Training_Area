import { validationError } from "@/lib/api-error";
import { exerciseUpdateSchema } from "@/lib/validation/content";
import { handleApiError } from "@/server/api-response";
import { requireRole } from "@/server/auth/session";
import { updateGlobalExercise } from "@/server/platform/global-exercises";

/** PATCH — altera exercício global (404 se não for global). */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/super-admin/exercises/[id]">,
) {
  try {
    await requireRole("SUPER_ADMIN", request.headers);
    const parsed = exerciseUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const { id } = await ctx.params;
    return Response.json({ exercise: await updateGlobalExercise(id, parsed.data) });
  } catch (error) {
    return handleApiError(error);
  }
}
