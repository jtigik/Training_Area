import { z } from "zod";

const item = z.string().trim().min(1, { error: "Item vazio" }).max(500);
const list = z.array(item).max(20, { error: "No máximo 20 itens" });

/**
 * PATCH /api/professor/feedbacks/:id — edição SEPARADA do resumo e das duas listas.
 * Campo omitido = não mexe; `null` = descarta a edição (volta a valer a versão da IA).
 * Lista vazia [] é uma edição válida (o aluno verá a lista vazia).
 */
export const feedbackEditSchema = z
  .strictObject({
    text: z.string().trim().min(1, { error: "Resumo vazio" }).max(4000).nullable(),
    strengths: list.nullable(),
    toReview: list.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    error: "Informe ao menos um campo: text, strengths ou toReview",
  });

/** POST /api/professor/feedbacks/:id/review — aprovar ou rejeitar (motivo obrigatório). */
export const feedbackReviewSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("approve") }),
  z.strictObject({
    action: z.literal("reject"),
    reason: z.string().trim().min(10, { error: "Motivo com pelo menos 10 caracteres" }).max(2000),
  }),
]);

export type FeedbackEditInput = z.infer<typeof feedbackEditSchema>;
export type FeedbackReviewInput = z.infer<typeof feedbackReviewSchema>;
