/**
 * Dados de conteúdo do seed (sem efeitos colaterais: importável por testes).
 * Formato de célula combinado: number | string | boolean | null | { f, v? }.
 */
import type { ExerciseInput } from "../src/lib/validation/content";

/** Exercício global do seed — validado por exerciseInputSchema (src/lib/validation/seed-data.test.ts). */
export type GlobalExercise = Pick<
  ExerciseInput,
  "title" | "statement" | "initialSheet" | "expectedResult" | "hint" | "level" | "difficulty"
> & { id: string; gradingRules?: ExerciseInput["gradingRules"] };

/** Banco inicial: exercícios globais (tenantId nulo, isGlobal = true). */
export const GLOBAL_EXERCISES: GlobalExercise[] = [
  {
    id: "global-ex-soma",
    title: "Somar vendas do trimestre",
    statement: "Em **B4**, some as vendas de B1 a B3.",
    initialSheet: {
      cells: {
        A1: "Jan",
        B1: 120,
        A2: "Fev",
        B2: 95,
        A3: "Mar",
        B3: 140,
        A4: "Total",
      },
    },
    expectedResult: [{ cell: "B4", formula: "=SOMA(B1:B3)" }],
    hint: "Use a função SOMA com um intervalo.",
    level: "FUNDAMENTAL",
    difficulty: "VERY_EASY",
  },
  {
    id: "global-ex-media",
    title: "Média de notas",
    statement: "Em **B5**, calcule a média das notas de B1 a B4.",
    initialSheet: {
      cells: { B1: 7, B2: 8.5, B3: 6, B4: 9 },
    },
    expectedResult: [{ cell: "B5", formula: "=MÉDIA(B1:B4)", tolerance: 0.001 }],
    hint: "MÉDIA (ou AVERAGE) recebe um intervalo.",
    level: "FUNDAMENTAL",
    difficulty: "EASY",
  },
  {
    id: "global-ex-se",
    title: "Aprovado ou reprovado",
    statement: 'Em **C1**, mostre "Aprovado" se B1 for maior ou igual a 7; senão, "Reprovado".',
    initialSheet: { cells: { A1: "Nota", B1: 8 } },
    expectedResult: [{ cell: "C1", formula: '=SE(B1>=7;"Aprovado";"Reprovado")' }],
    hint: "SE(teste; valor_se_verdadeiro; valor_se_falso).",
    level: "FUNDAMENTAL",
    difficulty: "MEDIUM",
  },
  {
    id: "global-ex-procv",
    title: "Buscar preço com PROCV",
    statement:
      "Em **E1**, use PROCV para buscar o preço do produto informado em D1 na tabela A1:B3.",
    initialSheet: {
      cells: {
        A1: "Caneta",
        B1: 2.5,
        A2: "Caderno",
        B2: 18,
        A3: "Lápis",
        B3: 1.2,
        D1: "Caderno",
      },
    },
    expectedResult: [{ cell: "E1", formula: "=PROCV(D1;A1:B3;2;FALSO)" }],
    hint: "O 4º argumento FALSO exige correspondência exata.",
    level: "PROFESSIONAL",
    difficulty: "MEDIUM",
  },
  {
    id: "global-ex-somases",
    title: "Somar por categoria (SOMASES)",
    statement: 'Em **E1**, some os valores da coluna B cuja categoria (coluna A) é "Alimentação".',
    initialSheet: {
      cells: {
        A1: "Alimentação",
        B1: 50,
        A2: "Transporte",
        B2: 30,
        A3: "Alimentação",
        B3: 25,
      },
    },
    expectedResult: [{ cell: "E1", formula: '=SOMASES(B1:B3;A1:A3;"Alimentação")' }],
    hint: "SOMASES(intervalo_soma; intervalo_critério; critério).",
    level: "ADVANCED",
    difficulty: "HARD",
  },
];
