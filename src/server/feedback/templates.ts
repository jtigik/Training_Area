import { z } from "zod";

import { MVP_LEVELS, type KnowledgeLevel, type TenantId } from "@/server/domain";

import { CONCEPTS, type Concept } from "./concept";

/**
 * Teacher-editable feedback template (replaces the % bands of TA-027 with concepts).
 * Resolution picks the most specific template: set+level+concept > set+level > set > platform.
 * A null field means "any". Approved feedback stores a snapshot, so later edits never rewrite
 * history (TA-027).
 */
export interface FeedbackTemplateRecord {
  id: string;
  tenantId: TenantId;
  setId: string | null;
  level: KnowledgeLevel | null;
  concept: Concept | null;
  /** Free-text guidance for the AI (tone, focus). Supports {{placeholders}}. */
  instructions: string;
  /** Short rules the AI must follow (e.g. "Sempre sugira um exercício de revisão"). */
  rules: string[];
  /** Text used when AI is disabled (rule-based draft). Supports {{placeholders}}. */
  fallbackText: string;
  version: number;
  updatedAt: Date;
}

export type TemplateSnapshot = Pick<
  FeedbackTemplateRecord,
  "id" | "version" | "instructions" | "rules" | "fallbackText"
>;

export const feedbackTemplateInputSchema = z.object({
  setId: z.string().min(1).nullable(),
  level: z.enum(MVP_LEVELS).nullable(),
  concept: z.enum(CONCEPTS).nullable(),
  instructions: z.string().trim().max(4000),
  rules: z.array(z.string().trim().min(1).max(300)).max(20),
  fallbackText: z.string().trim().min(1).max(4000),
});

export const PLACEHOLDERS = [
  "nivel",
  "conceito",
  "conceitoDescricao",
  "taxaAcerto",
  "exerciciosCorretos",
  "exerciciosExigidos",
  "funcoesMaisUsadas",
  "errosFrequentes",
  "podeRefazer",
] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

export const DEFAULT_FEEDBACK_TEMPLATE: TemplateSnapshot = {
  id: "platform-default",
  version: 1,
  instructions:
    "Seja encorajador e objetivo. Comente a lógica das fórmulas (escolha de funções, uso de referências em vez de valores fixos, referências absolutas quando fizer sentido, simplicidade) e não apenas os acertos.",
  rules: [
    "Escreva no máximo 3 parágrafos curtos.",
    "Cite no máximo 3 pontos fortes e 3 pontos a melhorar.",
    "Se o aluno puder refazer o nível, incentive a nova tentativa.",
  ],
  fallbackText:
    "Você concluiu o nível {{nivel}} com conceito {{conceito}} ({{conceitoDescricao}}), acertando {{exerciciosCorretos}} de {{exerciciosExigidos}} exercícios ({{taxaAcerto}}%). Funções mais usadas: {{funcoesMaisUsadas}}. {{podeRefazer}}",
};

/** Replaces known {{placeholders}}; unknown ones are left untouched. */
export function renderTemplate(text: string, vars: Partial<Record<Placeholder, string>>): string {
  return text.replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? (vars[key as Placeholder] ?? "") : whole,
  );
}

export function resolveTemplate(
  candidates: FeedbackTemplateRecord[],
  ctx: { setId: string; level: KnowledgeLevel; concept: Concept },
): TemplateSnapshot {
  let best: FeedbackTemplateRecord | null = null;
  let bestScore = -1;
  for (const t of candidates) {
    if (t.setId !== null && t.setId !== ctx.setId) continue;
    if (t.level !== null && t.level !== ctx.level) continue;
    if (t.concept !== null && t.concept !== ctx.concept) continue;
    const score = (t.setId ? 4 : 0) + (t.level ? 2 : 0) + (t.concept ? 1 : 0);
    if (score > bestScore || (score === bestScore && best && t.updatedAt > best.updatedAt)) {
      best = t;
      bestScore = score;
    }
  }
  if (!best) return DEFAULT_FEEDBACK_TEMPLATE;
  const { id, version, instructions, rules, fallbackText } = best;
  return { id, version, instructions, rules: [...rules], fallbackText };
}
