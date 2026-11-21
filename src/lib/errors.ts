import { ApiError } from "./services/contracts";

/** Mensagens claras para códigos conhecidos (o texto do servidor é o fallback). */
export const ERROR_MESSAGES: Record<string, string> = {
  GENERATION_NOT_READY:
    "A IA ainda não gerou este feedback. Escreva o texto você mesmo para aprovar ou aguarde a geração.",
  ALREADY_REVIEWED: "Este feedback já foi revisado por alguém. Atualize a lista.",
  LEVEL_NOT_REDOABLE: "Só é possível refazer o nível quando o melhor conceito é ND ou ED.",
};

/** Mensagem amigável para exibir ao usuário. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return ERROR_MESSAGES[error.code] ?? error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Algo deu errado. Tente novamente.";
}
