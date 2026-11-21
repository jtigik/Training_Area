import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError, type AttemptResult, type Exercise } from "@/lib/api";
import { ExerciseWorkspace } from "./exercise-workspace";

const exercise: Exercise = {
  id: "e2e-soma-basica",
  level: "FUNDAMENTAL",
  difficulty: "VERY_EASY",
  title: "Soma básica",
  statement: "Some A1:A3 em A4.",
  sheet: { rows: 5, cols: 2, cells: { A1: 10, A2: 20, A3: 30 } },
  targetCell: "A4",
  relatedSection: null,
  status: "NOT_STARTED",
  attempts: 0,
  lastSubmission: null,
  position: { index: 0, total: 5, nextExerciseId: "ex-soma" },
};

const result: AttemptResult = {
  attemptId: "att-1",
  correct: true,
  feedbackCode: "CORRECT",
  actualValue: 60,
  errors: [],
  hint: null,
  levelProgress: { required: 5, done: 1, correct: 1 },
  levelStatus: "IN_PROGRESS",
  levelCompleted: false,
};

const formula = () => screen.getByRole("textbox", { name: /Fórmula ou valor da célula A4/ });
const sendButton = () => screen.getByRole("button", { name: /Enviar resposta|Resposta enviada/ });

describe("ExerciseWorkspace", () => {
  it("blocks an empty answer: button disabled, message shown, nothing sent", async () => {
    const submit = vi.fn();
    render(<ExerciseWorkspace exercise={exercise} submit={submit} />);
    expect(sendButton()).toBeDisabled();
    expect(screen.getByTestId("submit-blocked")).toHaveTextContent(/Digite uma fórmula/);
    const user = userEvent.setup();
    await user.type(formula(), "   ");
    expect(sendButton()).toBeDisabled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("tests formulas locally without limit, then allows a single final submission", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue(result);
    render(<ExerciseWorkspace exercise={exercise} submit={submit} />);
    await user.type(formula(), "=SOMA(A1:A2){Enter}");
    await user.clear(formula());
    await user.type(formula(), "=SOMA(A1:A3){Enter}");
    expect(screen.getByTestId("cell-A4")).toHaveTextContent("60");
    expect(submit).not.toHaveBeenCalled();

    await user.click(sendButton());
    expect(submit).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith("e2e-soma-basica", {
      submission: "=SOMA(A1:A3)",
      clientValue: 60,
    });
    expect(await screen.findByRole("heading", { name: /Correto/ })).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
    expect(sendButton()).toHaveTextContent("Resposta enviada");
    expect(screen.getByTestId("submission-state")).toHaveTextContent("Enviado");
  });

  it("starts in the submitted state when the exercise was already submitted", () => {
    render(
      <ExerciseWorkspace
        exercise={{ ...exercise, attempts: 1, status: "INCORRECT", lastSubmission: "=A1" }}
        submit={vi.fn()}
      />,
    );
    expect(sendButton()).toBeDisabled();
    expect(screen.getByTestId("already-submitted")).toHaveTextContent(/incorreta/);
  });

  it("handles 409 ALREADY_SUBMITTED from the server", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockRejectedValue(new ApiError(409, "ALREADY_SUBMITTED", "Já enviado."));
    render(<ExerciseWorkspace exercise={exercise} submit={submit} />);
    await user.type(formula(), "=A1");
    await user.click(sendButton());
    expect(await screen.findByText(/O envio final é único/)).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
  });

  it("marks formula errors with data-testid=formula-error", async () => {
    const user = userEvent.setup();
    render(<ExerciseWorkspace exercise={exercise} submit={vi.fn()} />);
    await user.type(formula(), "=SOMA(A1:A3{Enter}");
    expect(screen.getByTestId("formula-error")).toHaveTextContent(/Fórmula com erro/);
  });

  it("warns before submitting a volatile function", async () => {
    const user = userEvent.setup();
    render(<ExerciseWorkspace exercise={exercise} submit={vi.fn()} />);
    await user.type(formula(), "=HOJE()*0+60");
    expect(await screen.findByTestId("volatile-warning")).toHaveTextContent(/AGORA, HOJE/);
  });
});
