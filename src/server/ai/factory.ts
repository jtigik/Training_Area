import { MockAiProvider } from "./mock";
import { OpenAiCompatibleProvider } from "./openai-compatible";
import { AiProviderError, type AiProvider } from "./types";

/**
 * Environment variables (aligned with Backend 1's src/lib/env.ts `AI_PROVIDERS`):
 *   AI_PROVIDER    disabled (default) | mock | openai-compatible
 *   AI_API_KEY     required for openai-compatible
 *   AI_BASE_URL    required for openai-compatible (OpenAI itself: https://api.openai.com/v1)
 *   AI_MODEL       default "gpt-4o-mini"
 *   AI_TIMEOUT_MS  default 30000
 * Returns `null` when disabled: level feedback then falls back to the rule/template draft.
 */
export type AiEnv = Partial<
  Record<"AI_PROVIDER" | "AI_API_KEY" | "AI_MODEL" | "AI_BASE_URL" | "AI_TIMEOUT_MS", string>
>;

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export function createAiProvider(
  env: AiEnv,
  options: { fetchImpl?: typeof fetch } = {},
): AiProvider | null {
  const kind = (env.AI_PROVIDER ?? "disabled").trim().toLowerCase();
  const timeoutMs = env.AI_TIMEOUT_MS ? Number(env.AI_TIMEOUT_MS) : undefined;
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    throw new AiProviderError("CONFIG", "AI_TIMEOUT_MS must be a positive number");
  }
  switch (kind) {
    case "":
    case "disabled":
      return null;
    case "mock":
      return new MockAiProvider();
    case "openai-compatible":
      if (!env.AI_API_KEY)
        throw new AiProviderError("CONFIG", "AI_API_KEY is required for openai-compatible");
      if (!env.AI_BASE_URL)
        throw new AiProviderError("CONFIG", "AI_BASE_URL is required for openai-compatible");
      return new OpenAiCompatibleProvider({
        name: "openai-compatible",
        apiKey: env.AI_API_KEY,
        model: env.AI_MODEL || DEFAULT_OPENAI_MODEL,
        baseUrl: env.AI_BASE_URL,
        timeoutMs,
        fetchImpl: options.fetchImpl,
      });
    default:
      throw new AiProviderError("CONFIG", `Unknown AI_PROVIDER: ${kind}`);
  }
}
