import { describe, expect, it } from "vitest";

import { feedbackDisplayText, studentVisibleFeedbackText } from "./feedback";

describe("feedback", () => {
  it("prefere o texto editado pelo professor", () => {
    expect(feedbackDisplayText({ aiText: "IA", editedText: "Professor" })).toBe("Professor");
    expect(feedbackDisplayText({ aiText: "IA", editedText: "  " })).toBe("IA");
    expect(feedbackDisplayText({ aiText: "IA", editedText: null })).toBe("IA");
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
