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

/** Campos de lista do feedback: originais da IA + edição do professor (JSON string[] ou nulo). */
export interface FeedbackListFields {
  aiStrengths: string[];
  aiToReview: string[];
  editedStrengths: unknown;
  editedToReview: unknown;
}

/** Lista editada válida (array de strings) ou null = sem edição. */
export function editedList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((v) => typeof v === "string") ? value : null;
}

/** Listas finais: a edição do professor, se houver (mesmo vazia), senão a da IA. */
export function feedbackDisplayLists(feedback: FeedbackListFields): {
  strengths: string[];
  toReview: string[];
} {
  return {
    strengths: editedList(feedback.editedStrengths) ?? feedback.aiStrengths,
    toReview: editedList(feedback.editedToReview) ?? feedback.aiToReview,
  };
}
