/** Provider-agnostic chat completion contract. */

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompletionRequest {
  messages: AiMessage[];
  /** Ask the provider for a JSON object response when supported. */
  responseFormat?: "json" | "text";
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface AiCompletionResponse {
  content: string;
  provider: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
}

export type AiProviderErrorCode = "CONFIG" | "HTTP" | "TIMEOUT" | "NETWORK" | "BAD_RESPONSE";

export class AiProviderError extends Error {
  constructor(
    readonly code: AiProviderErrorCode,
    message: string,
    readonly options: { status?: number; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "AiProviderError";
  }

  get retryable(): boolean {
    return this.options.retryable ?? false;
  }
}
