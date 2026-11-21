import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LevelFeedback } from "@/lib/api/types";
import { LevelFeedbackContent } from "./level-feedback-view";

const base: LevelFeedback = {
  level: "FUNDAMENTAL",
  completedAt: "2026-11-20T12:00:00.000Z",
  concept: "D",
  bestConcept: "D",
  run: 1,
  status: "IN_REVIEW",
  score: { correct: 4, total: 5, percent: 80 },
  attempts: 7,
  difficultiesPracticed: ["VERY_EASY", "EASY"],
  message: null,
  items: [
    {
      exerciseId: "a",
      title: "Soma",
      difficulty: "VERY_EASY",
      correct: true,
      attempts: 1,
      lastSubmission: "=SOMA(A1:A3)",
    },
    {
      exerciseId: "b",
      title: "Média",
      difficulty: "EASY",
      correct: false,
      attempts: 3,
      lastSubmission: "=A1",
    },
  ],
  nextLevel: { level: "PROFESSIONAL", unlocked: true, exerciseCount: 5, summary: "PROCV e SE" },
  recommendedSection: null,
};

const renderContent = (feedback: LevelFeedback) =>
  render(<LevelFeedbackContent feedback={feedback} onRefresh={vi.fn()} onRetaken={vi.fn()} />);

describe("LevelFeedbackContent", () => {
  it("shows the 'em revisão' state without any AI text while pending", () => {
    renderContent(base);
    const pending = screen.getByTestId("feedback-pending");
    expect(
      within(pending).getByRole("heading", { name: /Feedback em revisão/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Seu feedback" })).not.toBeInTheDocument();
    expect(screen.getAllByText(/80%/).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("concept-badge")[0]).toHaveTextContent("D");
  });

  it("shows the approved message once published", () => {
    renderContent({
      ...base,
      status: "PUBLISHED",
      message: {
        paragraphs: ["Muito bem no nível Fundamental."],
        strengths: ["Intervalos com SOMA"],
        toReview: ["MÉDIA com intervalos"],
        approvedAt: "2026-11-20T13:00:00.000Z",
      },
    });
    expect(screen.queryByTestId("feedback-pending")).not.toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Seu feedback" });
    expect(region).toHaveTextContent("Muito bem no nível Fundamental.");
    expect(region).toHaveTextContent("MÉDIA com intervalos");
  });

  it("offers 'Refazer nível' only for ND/ED", () => {
    const { unmount } = renderContent(base);
    expect(screen.queryByTestId("redo-button")).not.toBeInTheDocument();
    unmount();
    renderContent({ ...base, concept: "ED", bestConcept: "ED" });
    expect(screen.getByTestId("redo-button")).toBeInTheDocument();
  });

  it("uses the BEST concept for redo and shows the next level locked below D", () => {
    const { unmount } = renderContent({ ...base, concept: "ND", bestConcept: "D", run: 2 });
    expect(screen.queryByTestId("redo-button")).not.toBeInTheDocument();
    expect(screen.getByText(/melhor conceito/i)).toBeInTheDocument();
    unmount();
    renderContent({
      ...base,
      concept: "ED",
      bestConcept: "ED",
      nextLevel: { ...base.nextLevel!, unlocked: false },
    });
    expect(screen.getByTestId("next-level-locked")).toHaveTextContent("Profissional bloqueado");
    expect(screen.queryByText("Nível liberado")).not.toBeInTheDocument();
  });
});
