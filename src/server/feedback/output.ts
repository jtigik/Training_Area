import { z } from "zod";

/** Structured level feedback (AI output, teacher edit and what the student sees). */
export const feedbackContentSchema = z.object({
  message: z.string().trim().min(20).max(4000),
  strengths: z.array(z.string().trim().min(1).max(300)).max(6).default([]),
  improvements: z.array(z.string().trim().min(1).max(300)).max(6).default([]),
  nextSteps: z.array(z.string().trim().min(1).max(300)).max(6).default([]),
});

export type FeedbackContent = z.output<typeof feedbackContentSchema>;
export type FeedbackContentInput = z.input<typeof feedbackContentSchema>;

export type ParseFeedbackResult =
  { ok: true; content: FeedbackContent } | { ok: false; error: string };

/** Extracts and validates the JSON object from a model reply (tolerates ``` fences and prose). */
export function parseFeedbackOutput(raw: string): ParseFeedbackResult {
  const text = raw.replace(/```(?:json)?/gi, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "NO_JSON_OBJECT" };
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { ok: false, error: "INVALID_JSON" };
  }
  const parsed = feedbackContentSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: `SCHEMA: ${parsed.error.issues.map((i) => i.path.join(".") || "root").join(", ")}`,
    };
  }
  return { ok: true, content: parsed.data };
}

const squash = (s: string) => s.toUpperCase().replace(/\s+/g, "").replace(/;/g, ",");

/**
 * Flags drafts that quote an answer-key formula verbatim (TA-022: never reveal the answer key).
 * Only formulas with at least one function call or 12+ chars are checked to avoid noise.
 */
export function findAnswerKeyLeaks(content: FeedbackContent, answerKeys: string[]): string[] {
  const haystack = squash(
    [content.message, ...content.strengths, ...content.improvements, ...content.nextSteps].join(
      " ",
    ),
  );
  return answerKeys.filter((k) => {
    const key = squash(k).replace(/^=/, "");
    return (key.includes("(") || key.length >= 12) && haystack.includes(key);
  });
}
