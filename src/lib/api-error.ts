/**
 * Formato ÚNICO de erro das APIs do Training Area (acordado com BE2, FE1, FE2):
 *
 *   { "error": { "code": "NOT_FOUND", "message": "Tentativa não encontrada", "details"?: ... } }
 *
 * `code` é estável (o front decide por ele); `message` é texto pt-BR pronto para
 * exibir; `details` é opcional (ex.: problemas de validação por campo).
 * Exceção: /api/auth/* é do Better Auth e segue o formato da biblioteca.
 * Arquivo puro (sem server-only): os tipos servem também ao cliente.
 */
export interface ApiErrorPayload<D = unknown> {
  code: string;
  message: string;
  details?: D;
}

export interface ApiErrorBody<D = unknown> {
  error: ApiErrorPayload<D>;
}

/** Códigos genéricos; serviços podem usar códigos próprios (ex.: LAST_ADMIN). */
export const API_ERROR_CODES = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  SCOPE_DENIED: "SCOPE_DENIED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export interface ValidationIssue {
  path: string;
  message: string;
  code?: string;
}

export class ApiError<D = unknown> extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: D,
  ) {
    super(message);
    this.name = "ApiError";
  }

  toBody(): ApiErrorBody<D> {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined && { details: this.details }),
      },
    };
  }

  toResponse(): Response {
    return Response.json(this.toBody(), { status: this.status });
  }
}

/** Resposta de erro no formato padrão. */
export function apiError<D = unknown>(
  status: number,
  code: string,
  message: string,
  details?: D,
): Response {
  return new ApiError(status, code, message, details).toResponse();
}

/** Converte problemas do zod (ou similares) em details por campo. */
export function toValidationIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string; code?: string }[],
): ValidationIssue[] {
  return issues.map((i) => ({
    path: i.path.map(String).join("."),
    message: i.message,
    ...(i.code && { code: i.code }),
  }));
}

/**
 * 422 VALIDATION_ERROR com details: ValidationIssue[] (decisão do PO/QA: erro de
 * validação de corpo/parâmetros é 422 em todas as rotas, não 400).
 */
export function validationError(
  issues: readonly { path: readonly PropertyKey[]; message: string; code?: string }[],
  message = "Dados inválidos",
): Response {
  return apiError(422, API_ERROR_CODES.VALIDATION_ERROR, message, toValidationIssues(issues));
}

/** Type guard para o cliente: `if (isApiErrorBody(json)) show(json.error.message)`. */
export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== "object" || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return (
    !!error &&
    typeof error === "object" &&
    typeof (error as ApiErrorPayload).code === "string" &&
    typeof (error as ApiErrorPayload).message === "string"
  );
}
