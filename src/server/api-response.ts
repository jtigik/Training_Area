import { API_ERROR_CODES, ApiError, apiError } from "@/lib/api-error";
import { TenantScopeError } from "@/server/tenant-scope";

/**
 * Converte erros conhecidos em { error: { code, message, details? } }:
 * ApiError (AuthError, erros de serviço) e TenantScopeError (403 SCOPE_DENIED,
 * inclusive SUPER_ADMIN tentando ler registros individuais). Outros erros são
 * relançados (500 do Next, sem vazar detalhes).
 */
export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) return error.toResponse();
  if (error instanceof TenantScopeError) {
    return apiError(403, API_ERROR_CODES.SCOPE_DENIED, "Acesso negado");
  }
  throw error;
}
