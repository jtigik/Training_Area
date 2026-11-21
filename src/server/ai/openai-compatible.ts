import {
  AiProviderError,
  type AiCompletionRequest,
  type AiCompletionResponse,
  type AiProvider,
} from "./types";

export interface OpenAiCompatibleConfig {
  apiKey: string;
  model: string;
  /** e.g. https://api.openai.com/v1 (no trailing /chat/completions). */
  baseUrl: string;
  timeoutMs?: number;
  /** Provider label used in records (`openai`, `openai-compatible`, …). */
  name?: string;
  fetchImpl?: typeof fetch;
}

interface ChatCompletionBody {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * OpenAI-compatible Chat Completions over plain fetch (OpenAI, Azure OpenAI via proxy,
 * OpenRouter, vLLM, Ollama's /v1…). No SDK. The API key never appears in errors.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  readonly name: string;
  readonly model: string;
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: OpenAiCompatibleConfig) {
    if (!config.apiKey) throw new AiProviderError("CONFIG", "AI API key is missing");
    if (!config.model) throw new AiProviderError("CONFIG", "AI model is missing");
    let base: URL;
    try {
      base = new URL(config.baseUrl);
    } catch {
      throw new AiProviderError("CONFIG", "AI base URL is invalid");
    }
    this.url = `${base.toString().replace(/\/+$/, "")}/chat/completions`;
    this.name = config.name ?? "openai-compatible";
    this.model = config.model;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
    let res: Response;
    try {
      res = await this.fetchImpl(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.4,
          ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
          ...(request.responseFormat === "json"
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
        signal,
      });
    } catch (e) {
      if (timeout.aborted)
        throw new AiProviderError("TIMEOUT", "AI request timed out", { retryable: true });
      throw new AiProviderError("NETWORK", `AI request failed: ${(e as Error).name}`, {
        retryable: true,
      });
    }
    if (!res.ok) {
      throw new AiProviderError("HTTP", `AI provider responded ${res.status}`, {
        status: res.status,
        retryable: res.status === 429 || res.status >= 500,
      });
    }
    let body: ChatCompletionBody;
    try {
      body = (await res.json()) as ChatCompletionBody;
    } catch {
      throw new AiProviderError("BAD_RESPONSE", "AI response is not JSON");
    }
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new AiProviderError("BAD_RESPONSE", "AI response has no message content");
    }
    return {
      content,
      provider: this.name,
      model: body.model ?? this.model,
      usage: {
        promptTokens: body.usage?.prompt_tokens,
        completionTokens: body.usage?.completion_tokens,
      },
    };
  }
}
