import { authErrorResponse, requireSession } from "@/server/auth/session";

/** Usuário da sessão atual (id, nome, e-mail, papel). 401 sem sessão. */
export async function GET(request: Request) {
  try {
    const { user } = await requireSession(request.headers);
    return Response.json({ user });
  } catch (error) {
    return authErrorResponse(error);
  }
}
