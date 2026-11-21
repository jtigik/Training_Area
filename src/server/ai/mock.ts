import type { AiCompletionRequest, AiCompletionResponse, AiProvider } from "./types";

export type MockResponder = (
  request: AiCompletionRequest,
  call: number,
) => string | Promise<string>;

/**
 * Deterministic provider for tests and local development (AI_PROVIDER=mock). By default it reads
 * the JSON data block of the last user message (see feedback/prompt.ts) and answers with a
 * feedback JSON built from it, so the same input always yields the same output.
 */
export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  readonly calls: AiCompletionRequest[] = [];

  constructor(
    private readonly responder: MockResponder = defaultResponder,
    readonly model = "mock-1",
  ) {}

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    this.calls.push(request);
    const content = await this.responder(request, this.calls.length);
    return {
      content,
      provider: this.name,
      model: this.model,
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }
}

function defaultResponder(request: AiCompletionRequest): string {
  const user = [...request.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const match = /<dados>([\s\S]*?)<\/dados>/.exec(user);
  let data: { conceito?: string; nivel?: string; taxaAcertoPercentual?: number } = {};
  try {
    data = match ? JSON.parse(match[1]!) : {};
  } catch {
    data = {};
  }
  const concept = data.conceito ?? "?";
  const pct = data.taxaAcertoPercentual ?? 0;
  return JSON.stringify({
    message: `Você concluiu o nível ${data.nivel ?? ""} com conceito ${concept} e ${pct}% de acerto. Continue praticando as funções em que teve mais dificuldade.`,
    strengths: pct >= 70 ? ["Boa taxa de acerto"] : [],
    improvements: pct < 70 ? ["Revisar os exercícios com erro"] : [],
    nextSteps: ["Refazer os exercícios marcados como incorretos"],
  });
}
