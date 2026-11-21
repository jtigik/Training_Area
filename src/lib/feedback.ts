import type { FeedbackStatus } from "./domain";

export interface FeedbackTextFields {
  status: FeedbackStatus;
  /** Nulo enquanto a geração está PENDING ou se FAILED. */
  aiText: string | null;
  editedText: string | null;
}

/** Texto final do feedback: edição do professor, se houver, senão o da IA ("" se nenhum). */
export function feedbackDisplayText(
  feedback: Pick<FeedbackTextFields, "aiText" | "editedText">,
): string {
  const edited = feedback.editedText?.trim();
  return edited ? edited : (feedback.aiText ?? "");
}

/** Aluno só vê feedback APPROVED (status de revisão, não o de geração). */
export function studentVisibleFeedbackText(feedback: FeedbackTextFields): string | null {
  return feedback.status === "APPROVED" ? feedbackDisplayText(feedback) : null;
}
