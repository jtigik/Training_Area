import { ApiError } from "./services/contracts";

/** Mensagem amigável para exibir ao usuário. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Algo deu errado. Tente novamente.";
}
