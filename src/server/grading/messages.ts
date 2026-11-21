import type { FeedbackCode } from "./types";

/** Default pt-BR texts for each feedback code (UI may override). Never reveal the answer key here. */
export const FEEDBACK_MESSAGES_PT_BR: Record<FeedbackCode, string> = {
  CORRECT: "Correto! Sua fórmula chegou ao resultado esperado.",
  WRONG_VALUE: "Incorreto: a fórmula funciona, mas o resultado não é o esperado.",
  WRONG_TYPE:
    "Incorreto: o resultado tem um tipo diferente do esperado (número, texto, data ou lógico).",
  INPUT_INSENSITIVE:
    "O resultado bate agora, mas a fórmula não acompanha os dados: mude os valores da planilha e confira. Evite números fixos.",
  MISSING_REQUIRED_FUNCTION:
    "O resultado está certo, mas este exercício pede o uso de uma função específica.",
  FORBIDDEN_FUNCTION: "Este exercício não permite uma das funções usadas.",
  UNSUPPORTED_FUNCTION: "Uma das funções usadas ainda não é suportada pela ferramenta.",
  HARDCODED_VALUE:
    "Use uma fórmula que referencie as células da planilha, em vez de digitar o valor.",
  FORMULA_REQUIRED: 'A resposta deve ser uma fórmula: comece com "=".',
  FORMULA_ERROR: "A fórmula retornou um erro do Excel (ex.: #DIV/0!, #REF!, #N/D).",
  PARSE_ERROR: "Não foi possível entender a fórmula. Verifique parênteses, aspas e separadores.",
  EMPTY_SUBMISSION: "Digite uma fórmula antes de enviar.",
  LIMIT_EXCEEDED: "A fórmula ou a planilha excede os limites permitidos.",
  INVALID_EXERCISE: "Este exercício está com problema de configuração. Avise o professor.",
};
