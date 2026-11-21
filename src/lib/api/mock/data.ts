import type { ExpectedValue, GradeOptions } from "@/lib/formula/check";
import type { CellInput } from "@/lib/formula/engine";
import type { Difficulty, KnowledgeLevel, Section, SessionUser } from "../types";

/** Mock-only data. In production the answer keys never leave the server. */

export const MOCK_TENANT = {
  id: "inst-exemplo",
  name: "Instituto Exemplo",
  slug: "instituto-exemplo",
};

/** Mock accounts. The mock "Google/Microsoft" sign-in logs in as the first one (the student). */
export const MOCK_USERS: SessionUser[] = [
  {
    id: "u-aluno",
    name: "Ana Souza",
    email: "ana.souza@exemplo.edu.br",
    role: "ALUNO",
    tenantId: MOCK_TENANT.id,
    tenant: MOCK_TENANT,
  },
  {
    id: "u-prof",
    name: "Paulo Lima",
    email: "paulo.lima@exemplo.edu.br",
    role: "PROFESSOR",
    tenantId: MOCK_TENANT.id,
    tenant: MOCK_TENANT,
  },
];

export interface MockLevel {
  level: KnowledgeLevel;
  description: string;
  required: number;
  exerciseIds: string[];
}

export const MOCK_LEVELS: MockLevel[] = [
  {
    level: "FUNDAMENTAL",
    description:
      "Referências de célula, operações básicas e as primeiras funções: SOMA, MÉDIA, MÁXIMO e MÍNIMO.",
    required: 5,
    exerciseIds: ["e2e-soma-basica", "ex-soma", "ex-media", "ex-maximo", "ex-minimo"],
  },
  {
    level: "PROFESSIONAL",
    description: "Lógica com SE, contagens condicionais e arredondamento.",
    required: 2,
    exerciseIds: ["ex-se", "ex-contse"],
  },
  {
    level: "ADVANCED",
    description: "Busca e referência com PROCV, ÍNDICE e CORRESP.",
    required: 1,
    exerciseIds: ["ex-procv"],
  },
];

export const MOCK_SECTIONS: Section[] = [
  {
    id: "sec-intro",
    title: "Como usar esta trilha",
    order: 0,
    level: null,
    readMinutes: 2,
    body: `# Bem-vindo(a)!\n\nCada nível tem **seções de conteúdo** para estudar e **exercícios** para praticar.\n\n- Leia as seções do nível.\n- Abra um exercício e digite fórmulas na barra de fórmulas.\n- O resultado aparece em tempo real. Quando estiver pronto(a), clique em **Enviar resposta**.\n\n![Barra de fórmulas: caixa de nome A4, fx e =SOMA(A1:A3)](/conteudo/barra-de-formulas.svg)\n\nVocê pode escrever as funções em português (\`=SOMA(A1:A3)\`) ou em inglês (\`=SUM(A1:A3)\`).`,
  },
  {
    id: "sec-referencias",
    title: "Células, intervalos e operadores",
    order: 1,
    level: "FUNDAMENTAL",
    readMinutes: 4,
    body: `## Endereços de célula\n\nCada célula é identificada pela **coluna** (letra) e pela **linha** (número): \`A1\`, \`B3\`, \`C10\`.\n\n## Intervalos\n\nUm intervalo usa dois-pontos: \`A1:A5\` são as células de A1 até A5.\n\n## Operadores\n\n| Operador | Significado |\n|---|---|\n| \`+\` | soma |\n| \`-\` | subtração |\n| \`*\` | multiplicação |\n| \`/\` | divisão |\n\nToda fórmula começa com \`=\`.`,
  },
  {
    id: "sec-funcoes-basicas",
    title: "SOMA, MÉDIA, MÁXIMO e MÍNIMO",
    order: 2,
    level: "FUNDAMENTAL",
    readMinutes: 5,
    body: `## SOMA\n\n\`=SOMA(A1:A5)\` soma todos os valores do intervalo.\n\n## MÉDIA\n\n\`=MÉDIA(A1:A5)\` calcula a média aritmética.\n\n## MÁXIMO e MÍNIMO\n\n\`=MÁXIMO(A1:A5)\` e \`=MÍNIMO(A1:A5)\` retornam o maior e o menor valor.\n\n> Dica: no Excel em português os argumentos são separados por **ponto e vírgula** (\`;\`). Aqui você pode usar \`;\` ou \`,\`.`,
  },
  {
    id: "sec-se",
    title: "Decisões com SE",
    order: 3,
    level: "PROFESSIONAL",
    readMinutes: 5,
    body: `## Sintaxe\n\n\`=SE(teste_lógico; valor_se_verdadeiro; valor_se_falso)\`\n\nExemplo: \`=SE(B2>=7;"Aprovado";"Reprovado")\`.\n\n## CONT.SE\n\n\`=CONT.SE(B2:B6;">=7")\` conta quantas células atendem ao critério.`,
  },
  {
    id: "sec-procv",
    title: "Buscando dados com PROCV",
    order: 4,
    level: "ADVANCED",
    readMinutes: 6,
    body: `\`=PROCV(valor_procurado; tabela; núm_coluna; FALSO)\` procura um valor na primeira coluna da tabela e devolve o valor da coluna indicada.`,
  },
];

export interface MockExercise {
  id: string;
  level: KnowledgeLevel;
  difficulty: Difficulty;
  title: string;
  statement: string;
  sheet: { rows: number; cols: number; cells: Record<string, CellInput> };
  targetCell: string;
  hint: string;
  relatedSectionId: string | null;
  expected: ExpectedValue;
  options?: GradeOptions;
}

type Def = Omit<MockExercise, "sheet"> & {
  cells: Record<string, CellInput>;
  size?: { rows: number; cols: number };
};

const ex = ({ cells, size = { rows: 10, cols: 6 }, ...rest }: Def): MockExercise => ({
  ...rest,
  sheet: { ...size, cells },
});

const NOTAS = {
  A1: "Aluno",
  B1: "Nota",
  A2: "Bia",
  B2: 7,
  A3: "Caio",
  B3: 5.5,
  A4: "Duda",
  B4: 9,
  A5: "Enzo",
  B5: 6.9,
  A6: "Fábio",
  B6: 8.2,
  A7: "Gabi",
  B7: 7.1,
};
const TEMPS = {
  A1: "Dia",
  B1: "Temp. (°C)",
  A2: "1",
  B2: 22,
  A3: "2",
  B3: 25.5,
  A4: "3",
  B4: 19,
  A5: "4",
  B5: 28,
  A6: "5",
  B6: 24,
  A7: "6",
  B7: 17.5,
  A8: "7",
  B8: 21,
};

export const MOCK_EXERCISES: MockExercise[] = [
  // Same data as QA's e2e/data/formulas.json, so the E2E specs can run against the mock.
  ex({
    id: "e2e-soma-basica",
    level: "FUNDAMENTAL",
    difficulty: "VERY_EASY",
    title: "Soma básica",
    statement:
      "As células **A1** a **A3** têm três valores. Em **A4**, escreva uma fórmula que calcule a **soma** deles.",
    cells: { A1: 10, A2: 20, A3: 30 },
    targetCell: "A4",
    expected: 60,
    hint: "Use a função SOMA com o intervalo A1:A3.",
    relatedSectionId: "sec-funcoes-basicas",
    size: { rows: 8, cols: 4 },
  }),
  ex({
    id: "ex-soma",
    level: "FUNDAMENTAL",
    difficulty: "VERY_EASY",
    title: "Total de vendas da semana",
    statement:
      "A coluna **B** traz as vendas de segunda a sexta. Em **B7**, escreva uma fórmula que calcule o **total** da semana.",
    cells: {
      A1: "Dia",
      B1: "Vendas",
      A2: "Seg",
      B2: 120,
      A3: "Ter",
      B3: 95,
      A4: "Qua",
      B4: 143,
      A5: "Qui",
      B5: 88,
      A6: "Sex",
      B6: 210,
      A7: "Total",
      A8: "Meta (5 x seg)",
      B8: { f: "=B2*5", v: 600 },
    },
    targetCell: "B7",
    expected: 656,
    hint: "Use a função SOMA com o intervalo B2:B6.",
    relatedSectionId: "sec-funcoes-basicas",
  }),
  ex({
    id: "ex-media",
    level: "FUNDAMENTAL",
    difficulty: "EASY",
    title: "Média das notas",
    statement: "Calcule em **B6** a **média** das notas de B2 a B5.",
    cells: {
      A1: "Aluno",
      B1: "Nota",
      A2: "Bia",
      B2: 7.5,
      A3: "Caio",
      B3: 8,
      A4: "Duda",
      B4: 6.5,
      A5: "Enzo",
      B5: 9,
      A6: "Média",
    },
    targetCell: "B6",
    expected: 7.75,
    options: { numberTolerance: 0.001 },
    hint: "MÉDIA(intervalo) devolve a média aritmética.",
    relatedSectionId: "sec-funcoes-basicas",
  }),
  ex({
    id: "ex-maximo",
    level: "FUNDAMENTAL",
    difficulty: "MEDIUM",
    title: "Maior temperatura da semana",
    statement: "Em **B9**, mostre a **maior** temperatura registrada (B2:B8).",
    cells: { ...TEMPS, A9: "Máxima" },
    targetCell: "B9",
    expected: 28,
    hint: "MÁXIMO(intervalo) retorna o maior valor.",
    relatedSectionId: "sec-funcoes-basicas",
    size: { rows: 12, cols: 6 },
  }),
  ex({
    id: "ex-minimo",
    level: "FUNDAMENTAL",
    difficulty: "MEDIUM",
    title: "Menor temperatura da semana",
    statement: "Em **B9**, mostre a **menor** temperatura registrada (B2:B8).",
    cells: { ...TEMPS, A9: "Mínima" },
    targetCell: "B9",
    expected: 17.5,
    hint: "MÍNIMO(intervalo) retorna o menor valor.",
    relatedSectionId: "sec-funcoes-basicas",
    size: { rows: 12, cols: 6 },
  }),
  ex({
    id: "ex-se",
    level: "PROFESSIONAL",
    difficulty: "EASY",
    title: "Aprovado ou reprovado",
    statement:
      'Em **C2**, mostre **"Aprovado"** se a nota em B2 for maior ou igual a 7; caso contrário, **"Reprovado"**.',
    cells: { A1: "Aluno", B1: "Nota", C1: "Situação", A2: "Bia", B2: 6.8 },
    targetCell: "C2",
    expected: "Reprovado",
    options: { caseInsensitive: true },
    hint: 'A estrutura é =SE(teste; "texto se verdadeiro"; "texto se falso").',
    relatedSectionId: "sec-se",
  }),
  ex({
    id: "ex-contse",
    level: "PROFESSIONAL",
    difficulty: "MEDIUM",
    title: "Quantos foram aprovados?",
    statement: "Em **B8**, conte quantas notas de B2 a B7 são **maiores ou iguais a 7**.",
    cells: { ...NOTAS, A8: "Aprovados" },
    targetCell: "B8",
    expected: 4,
    hint: 'CONT.SE(intervalo; ">=7").',
    relatedSectionId: "sec-se",
  }),
  ex({
    id: "ex-procv",
    level: "ADVANCED",
    difficulty: "HARD",
    title: "Preço pelo código",
    statement: "Em **E2**, use o código em **D2** para buscar o **preço** na tabela A1:B5.",
    cells: {
      A1: "Código",
      B1: "Preço",
      A2: "P01",
      B2: 12.5,
      A3: "P02",
      B3: 30,
      A4: "P03",
      B4: 7.25,
      A5: "P04",
      B5: 99.9,
      D1: "Código",
      D2: "P03",
      E1: "Preço",
    },
    targetCell: "E2",
    expected: 7.25,
    hint: "PROCV(valor; tabela; coluna; FALSO).",
    relatedSectionId: "sec-procv",
  }),
];
