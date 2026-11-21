import { describe, expect, it } from "vitest";

import { feedbackEditSchema, feedbackReviewSchema } from "./feedback";

describe("feedbackEditSchema", () => {
  it("aceita edições separadas, null (descarta) e lista vazia", () => {
    expect(feedbackEditSchema.parse({ strengths: [" Usa SOMA bem "] })).toEqual({
      strengths: ["Usa SOMA bem"],
    });
    expect(feedbackEditSchema.parse({ text: null, toReview: [] })).toEqual({
      text: null,
      toReview: [],
    });
  });
  it("recusa corpo vazio, campo desconhecido, item vazio e resumo vazio", () => {
    for (const body of [{}, { aiText: "x" }, { strengths: [""] }, { text: "  " }]) {
      expect(feedbackEditSchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });
});

describe("feedbackReviewSchema", () => {
  it("approve sem motivo; reject exige motivo ≥ 10", () => {
    expect(feedbackReviewSchema.safeParse({ action: "approve" }).success).toBe(true);
    expect(feedbackReviewSchema.safeParse({ action: "reject", reason: "curto" }).success).toBe(
      false,
    );
    expect(
      feedbackReviewSchema.safeParse({ action: "reject", reason: "Texto genérico demais" }).success,
    ).toBe(true);
  });
});
