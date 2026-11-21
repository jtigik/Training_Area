import "server-only";

import { createAiProvider } from "./factory";
import type { AiProvider } from "./types";

let cached: AiProvider | null | undefined;

/** App entry point: provider from process.env, created once. Never import this from client code. */
export function getAiProvider(): AiProvider | null {
  if (cached === undefined)
    cached = createAiProvider({
      AI_PROVIDER: process.env.AI_PROVIDER,
      AI_API_KEY: process.env.AI_API_KEY,
      AI_MODEL: process.env.AI_MODEL,
      AI_BASE_URL: process.env.AI_BASE_URL,
      AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS,
    });
  return cached;
}
