import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReviewFeedback } from "@/lib/domain/types";
import { ReviewItem } from "./review-queue";

const base: ReviewFeedback = {
  id: "r1",
  tenantId: "t1",
  studentId: "s1",
  studentName: "Ana",
  setId: "set-1",
  setName: "Trilha",
  level: "FUNDAMENTAL",
  levelAttempt: 1,
  concept: "ED",
  accuracyPercent: 60,
  generationStatus: "GENERATED",
  generationError: null,
  aiText: "Texto da IA",
  strengths: ["Usa SOMA"],
  toReview: ["Intervalos"],
  finalText: "Texto da IA",
  status: "DRAFT",
  rejectionReason: null,
  reviewerId: null,
  reviewedAt: null,
  createdAt: "2026-11-20T10:00:00.000Z",
};
const noop = () => {};

describe("ReviewItem", () => {
  it("GENERATED: mostra pontos fortes, para revisar e permite aprovar/rejeitar", () => {
    render(<ReviewItem item={base} onDone={noop} />);
    expect(screen.getByRole("list", { name: "Pontos fortes" })).toHaveTextContent("Usa SOMA");
    expect(screen.getByRole("list", { name: "Para revisar" })).toHaveTextContent("Intervalos");
    expect(screen.getByTestId("feedback-approve")).toBeEnabled();
    expect(screen.getByTestId("feedback-reject")).toBeInTheDocument();
  });

  it("PENDING: mostra que está gerando e esconde as ações", () => {
    render(
      <ReviewItem
        item={{ ...base, generationStatus: "PENDING", aiText: null, finalText: "", strengths: [] }}
        onDone={noop}
      />,
    );
    expect(screen.getByTestId("feedback-generating")).toBeInTheDocument();
    expect(screen.queryByTestId("feedback-approve")).toBeNull();
    expect(screen.queryByTestId("feedback-edit")).toBeNull();
  });

  it("FAILED: mostra o erro e só aprova com texto escrito pelo professor", () => {
    render(
      <ReviewItem
        item={{
          ...base,
          generationStatus: "FAILED",
          generationError: "timeout",
          aiText: null,
          finalText: "",
          strengths: [],
          toReview: [],
        }}
        onDone={noop}
      />,
    );
    expect(screen.getByTestId("feedback-generation-error")).toHaveTextContent("timeout");
    expect(screen.getByTestId("feedback-approve")).toBeDisabled();
    expect(screen.queryByTestId("feedback-reject")).toBeNull();
    expect(screen.getByRole("button", { name: "Gerar novamente" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("feedback-edit"));
    fireEvent.change(screen.getByLabelText("Feedback para Ana"), {
      target: { value: "Ana, revise PROCV." },
    });
    expect(screen.getByTestId("feedback-approve")).toBeEnabled();
  });
});
