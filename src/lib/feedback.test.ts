import { describe, expect, it } from "vitest";

import {
  editedList,
  feedbackDisplayLists,
  feedbackDisplayText,
  studentVisibleFeedbackText,
} from "./feedback";

describe("feedback", () => {
  it("prefere o texto editado pelo professor", () => {
    expect(feedbackDisplayText({ aiText: "IA", editedText: "Professor" })).toBe("Professor");
    expect(feedbackDisplayText({ aiText: "IA", editedText: "  " })).toBe("IA");
    expect(feedbackDisplayText({ aiText: "IA", editedText: null })).toBe("IA");
  });

  it("sem texto da IA (PENDING/FAILED) usa só a edição do professor", () => {
    expect(feedbackDisplayText({ aiText: null, editedText: "Professor" })).toBe("Professor");
    expect(feedbackDisplayText({ aiText: null, editedText: null })).toBe("");
  });

  it("aluno só vê APPROVED", () => {
    expect(studentVisibleFeedbackText({ status: "APPROVED", aiText: "IA", editedText: null })).toBe(
      "IA",
    );
    expect(
      studentVisibleFeedbackText({ status: "DRAFT", aiText: "IA", editedText: null }),
    ).toBeNull();
    expect(
      studentVisibleFeedbackText({ status: "REJECTED", aiText: "IA", editedText: "x" }),
    ).toBeNull();
  });
});

describe("feedbackDisplayLists", () => {
  const base = { aiStrengths: ["IA forte"], aiToReview: ["IA revisar"] };
  it("sem edição usa as listas da IA", () => {
    expect(feedbackDisplayLists({ ...base, editedStrengths: null, editedToReview: null })).toEqual({
      strengths: ["IA forte"],
      toReview: ["IA revisar"],
    });
  });
  it("edição do professor vence, inclusive lista vazia, e cada lista é independente", () => {
    expect(
      feedbackDisplayLists({ ...base, editedStrengths: ["Prof"], editedToReview: null }),
    ).toEqual({ strengths: ["Prof"], toReview: ["IA revisar"] });
    expect(feedbackDisplayLists({ ...base, editedStrengths: [], editedToReview: [] })).toEqual({
      strengths: [],
      toReview: [],
    });
  });
  it("JSON inválido é ignorado", () => {
    expect(editedList({ a: 1 })).toBeNull();
    expect(editedList([1, 2])).toBeNull();
  });
});
