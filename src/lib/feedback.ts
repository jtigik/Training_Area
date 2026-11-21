import type { FeedbackStatus } from "./domain";

export interface FeedbackTextFields {
  status: FeedbackStatus;
  aiText: string;
  editedText: string | null;
}

/** Texto final do feedback: edição do professor, se houver, senão o da IA. */
export function feedbackDisplayText(
  feedback: Pick<FeedbackTextFields, "aiText" | "editedText">,
): string {
  const edited = feedback.editedText?.trim();
  return edited ? edited : feedback.aiText;
}

/** Aluno só vê feedback APPROVED. Retorna null quando não é visível. */
export function studentVisibleFeedbackText(feedback: FeedbackTextFields): string | null {
  return feedback.status === "APPROVED" ? feedbackDisplayText(feedback) : null;
}
