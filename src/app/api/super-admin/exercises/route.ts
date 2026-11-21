import { validationError } from "@/lib/api-error";
import { exerciseInputSchema } from "@/lib/validation/content";
import { handleApiError } from "@/server/api-response";
import { requireRole } from "@/server/auth/session";
import { createGlobalExercise, listGlobalExercises } from "@/server/platform/global-exercises";

/** GET — banco global de exercícios. */
export async function GET(request: Request) {
  try {
    await requireRole("SUPER_ADMIN", request.headers);
    return Response.json({ exercises: await listGlobalExercises() });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST — cria exercício global (nível DASHBOARD recusado no MVP). */
export async function POST(request: Request) {
  try {
    const { user } = await requireRole("SUPER_ADMIN", request.headers);
    const parsed = exerciseInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    return Response.json(
      { exercise: await createGlobalExercise(user.id, parsed.data) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
