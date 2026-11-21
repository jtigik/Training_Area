import type { FeedbackCode } from "@/lib/api";

/** pt-BR text per grading code (same wording as Backend 2's FEEDBACK_MESSAGES_PT_BR). Never reveals the answer. */
export const FEEDBACK_MESSAGES: Record<FeedbackCode, string> = {
  CORRECT: "Sua fórmula chegou ao resultado esperado.",
  WRONG_VALUE: "A fórmula funciona, mas o resultado não é o esperado.",
  WRONG_TYPE: "O resultado tem um tipo diferente do esperado (número, texto, data ou lógico).",
  MISSING_REQUIRED_FUNCTION:
    "O resultado está certo, mas este exercício pede o uso de uma função específica.",
  FORBIDDEN_FUNCTION: "Este exercício não permite uma das funções usadas.",
  UNSUPPORTED_FUNCTION: "Uma das funções usadas ainda não é suportada pela ferramenta.",
  HARDCODED_VALUE:
    "Use uma fórmula que referencie as células da planilha, em vez de digitar o valor.",
  FORMULA_REQUIRED:
    'Use uma fórmula: a resposta deve começar com "=" e usar as células da planilha.',
  FORMULA_ERROR: "A fórmula retornou um erro do Excel (ex.: #DIV/0!, #REF!, #N/D).",
  PARSE_ERROR: "Não foi possível entender a fórmula. Verifique parênteses, aspas e separadores.",
  EMPTY_SUBMISSION: "Digite uma fórmula antes de enviar.",
  LIMIT_EXCEEDED: "A fórmula ou a planilha excede os limites permitidos.",
  INVALID_EXERCISE: "Este exercício está com problema de configuração. Avise o professor.",
};
