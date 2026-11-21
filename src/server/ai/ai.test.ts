// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  AiProviderError,
  createAiProvider,
  MockAiProvider,
  OpenAiCompatibleProvider,
} from "./index";

function fakeFetch(status: number, body: unknown) {
  return vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(
    async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
}

describe("createAiProvider", () => {
  it("desabilitado por padrão", () => {
    expect(createAiProvider({})).toBeNull();
    expect(createAiProvider({ AI_PROVIDER: "disabled" })).toBeNull();
  });

  it("cria mock e openai-compatible com padrões", () => {
    expect(createAiProvider({ AI_PROVIDER: "mock" })).toBeInstanceOf(MockAiProvider);
    const p = createAiProvider({
      AI_PROVIDER: "openai-compatible",
      AI_API_KEY: "sk-test",
      AI_BASE_URL: "https://api.openai.com/v1",
    });
    expect(p).toBeInstanceOf(OpenAiCompatibleProvider);
    expect(p?.model).toBe("gpt-4o-mini");
  });

  it("valida configuração", () => {
    // "openai" and "anthropic" are not MVP providers (Backend 1 AI_PROVIDERS)
    expect(() => createAiProvider({ AI_PROVIDER: "openai" })).toThrow(AiProviderError);
    expect(() => createAiProvider({ AI_PROVIDER: "anthropic" })).toThrow(/Unknown/);
    expect(() =>
      createAiProvider({ AI_PROVIDER: "openai-compatible", AI_BASE_URL: "http://x/v1" }),
    ).toThrow(/AI_API_KEY/);
    expect(() =>
      createAiProvider({ AI_PROVIDER: "openai-compatible", AI_API_KEY: "k", AI_MODEL: "m" }),
    ).toThrow(/AI_BASE_URL/);
    expect(() => createAiProvider({ AI_PROVIDER: "foo" })).toThrow(/Unknown/);
    expect(() => createAiProvider({ AI_PROVIDER: "mock", AI_TIMEOUT_MS: "-1" })).toThrow(
      /AI_TIMEOUT_MS/,
    );
  });
});

describe("OpenAiCompatibleProvider", () => {
  it("chama /chat/completions com Bearer e response_format json", async () => {
    const f = fakeFetch(200, {
      model: "m-1",
      choices: [{ message: { content: '{"ok":1}' } }],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    });
    const p = createAiProvider(
      {
        AI_PROVIDER: "openai-compatible",
        AI_API_KEY: "secret",
        AI_MODEL: "m",
        AI_BASE_URL: "http://llm.local/v1/",
      },
      { fetchImpl: f as unknown as typeof fetch },
    )!;
    const r = await p.complete({
      messages: [{ role: "user", content: "oi" }],
      responseFormat: "json",
    });
    expect(r).toMatchObject({
      content: '{"ok":1}',
      model: "m-1",
      provider: "openai-compatible",
      usage: { promptTokens: 3 },
    });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("http://llm.local/v1/chat/completions");
    expect((init!.headers as Record<string, string>).authorization).toBe("Bearer secret");
    expect(JSON.parse(init!.body as string)).toMatchObject({
      model: "m",
      response_format: { type: "json_object" },
    });
  });

  it("mapeia erros HTTP, resposta vazia e não vaza a chave", async () => {
    const p = (status: number, body: unknown) =>
      new OpenAiCompatibleProvider({
        apiKey: "secret-key",
        model: "m",
        baseUrl: "http://x/v1",
        fetchImpl: fakeFetch(status, body) as unknown as typeof fetch,
      });
    const err = await p(429, { error: "rate" })
      .complete({ messages: [] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err).toMatchObject({ code: "HTTP", retryable: true });
    expect(String((err as Error).message)).not.toContain("secret-key");
    await expect(p(400, {}).complete({ messages: [] })).rejects.toMatchObject({
      code: "HTTP",
      retryable: false,
    });
    await expect(p(200, { choices: [] }).complete({ messages: [] })).rejects.toMatchObject({
      code: "BAD_RESPONSE",
    });
    await expect(p(200, "not json").complete({ messages: [] })).rejects.toMatchObject({
      code: "BAD_RESPONSE",
    });
  });

  it("timeout e falha de rede", async () => {
    const hang = vi.fn(
      (_u: unknown, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    const slow = new OpenAiCompatibleProvider({
      apiKey: "k",
      model: "m",
      baseUrl: "http://x",
      timeoutMs: 20,
      fetchImpl: hang as unknown as typeof fetch,
    });
    await expect(slow.complete({ messages: [] })).rejects.toMatchObject({ code: "TIMEOUT" });
    const down = new OpenAiCompatibleProvider({
      apiKey: "k",
      model: "m",
      baseUrl: "http://x",
      fetchImpl: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    });
    await expect(down.complete({ messages: [] })).rejects.toMatchObject({ code: "NETWORK" });
  });
});

describe("MockAiProvider", () => {
  it("é determinístico e registra chamadas", async () => {
    const m = new MockAiProvider();
    const req = {
      messages: [
        {
          role: "user" as const,
          content:
            '<dados>{"conceito":"D","nivel":"Fundamental","taxaAcertoPercentual":75}</dados>',
        },
      ],
    };
    const a = await m.complete(req);
    const b = await m.complete(req);
    expect(a.content).toBe(b.content);
    expect(JSON.parse(a.content).message).toContain("conceito D");
    expect(m.calls).toHaveLength(2);
  });
});
