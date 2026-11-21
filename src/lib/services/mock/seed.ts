import { parseCellInput } from "../../domain/grid";
import type {
  Attempt,
  BankExercise,
  Classroom,
  ContentSection,
  Exercise,
  ExerciseContent,
  ExerciseSet,
  FeedbackTemplate,
  Institution,
  InstitutionSettings,
  LevelProgress,
  ReviewFeedback,
  User,
} from "../../domain/types";

const T0 = "2026-11-10T13:00:00.000Z";

export interface MockDb {
  version: number;
  institutions: Institution[];
  users: User[];
  settings: InstitutionSettings[];
  sections: ContentSection[];
  sets: ExerciseSet[];
  exercises: Exercise[];
  bank: BankExercise[];
  /** Templates por instituição; `setId = null` = padrão da instituição. */
  feedback: (FeedbackTemplate & { tenantId: string })[];
  reviews: ReviewFeedback[];
  attempts: (Attempt & { tenantId: string })[];
  progress: (LevelProgress & { tenantId: string })[];
  classrooms: Classroom[];
}

export const MOCK_DB_VERSION = 4;
/** Instituição da sessão simulada (professor e admin da instituição). */
export const MOCK_INSTITUTION_ID = "inst-1";

function user(
  id: string,
  tenantId: string | null,
  name: string,
  email: string,
  role: User["role"],
  active = true,
): User {
  return { id, tenantId, name, email, role, active, createdAt: T0, updatedAt: T0 };
}

/** Três faixas padrão (0–49 / 50–79 / 80–100); o professor ajusta em /professor/feedback. */
export const DEFAULT_BANDS: FeedbackTemplate["bands"] = [
  {
    id: "fb-def-1",
    minPercent: 0,
    maxPercent: 49,
    label: "Não demonstrou",
    template:
      "{{nome}}, você concluiu o nível {{nivel}} com {{acertos}} de {{total}} acertos ({{percentual}}). Revise as seções do nível e refaça os exercícios em que errou.",
  },
  {
    id: "fb-def-2",
    minPercent: 50,
    maxPercent: 79,
    label: "Em desenvolvimento",
    template:
      "{{nome}}, bom começo: {{acertos}} de {{total}} ({{percentual}}) no nível {{nivel}}. Pratique intervalos e referências.",
  },
  {
    id: "fb-def-3",
    minPercent: 80,
    maxPercent: 100,
    label: "Demonstrou",
    template: "Excelente, {{nome}}! Você dominou o nível {{nivel}} com {{percentual}} de acerto.",
  },
];

const sumContent: ExerciseContent = {
  title: "Somar vendas",
  statement: "Some os valores de A1 a A3 na célula A4.",
  level: "FUNDAMENTAL",
  difficulty: "VERY_EASY",
  grid: {
    rows: 6,
    cols: 4,
    cells: {
      A1: { value: 10, locked: true },
      A2: { value: 20, locked: true },
      A3: { value: 30, locked: true },
    },
  },
  answers: { A4: { kind: "VALUE", expected: 60, tolerance: 0 } },
  hint: "Use a função SOMA.",
};

const avgContent: ExerciseContent = {
  title: "Média de notas",
  statement: "Calcule em B5 a média de B1:B4.",
  level: "FUNDAMENTAL",
  difficulty: "EASY",
  grid: {
    rows: 6,
    cols: 4,
    cells: {
      B1: { value: 7, locked: true },
      B2: { value: 8, locked: true },
      B3: { value: 6, locked: true },
      B4: { value: 9, locked: true },
    },
  },
  answers: { B5: { kind: "FORMULA", expected: { f: "=MÉDIA(B1:B4)" } } },
  hint: null,
};

const vlookupContent: ExerciseContent = {
  title: "Busca de preço",
  statement: "Use PROCV para achar em D2 o preço do produto escrito em D1.",
  level: "PROFESSIONAL",
  difficulty: "MEDIUM",
  grid: {
    rows: 6,
    cols: 4,
    cells: {
      A1: { value: "Caneta", locked: true },
      B1: { value: 2.5, locked: true },
      A2: { value: "Lápis", locked: true },
      B2: { value: 1.2, locked: true },
      D1: { value: "Lápis", locked: true },
    },
  },
  answers: { D2: { kind: "FORMULA", expected: { f: "=PROCV(D1;A1:B2;2;FALSO)" } } },
  hint: "O quarto argumento FALSO pede correspondência exata.",
};

function bankItem(
  id: string,
  c: ExerciseContent,
  tags: string[],
  tenantId: string | null = null,
): BankExercise {
  return {
    id,
    tenantId,
    origin: tenantId ? "INSTITUTION" : "PLATFORM",
    source: tenantId ? "EDITOR" : "SEED",
    status: "PUBLISHED",
    tags,
    ...structuredClone(c),
    createdAt: T0,
    updatedAt: T0,
  };
}

export function createSeed(): MockDb {
  const institutions: Institution[] = [
    {
      id: "inst-1",
      name: "Escola Exemplo",
      slug: "escola-exemplo",
      active: true,
      domains: ["escola.edu.br"],
      userCount: 8,
      createdAt: T0,
      updatedAt: T0,
    },
    {
      id: "inst-2",
      name: "Empresa Beta",
      slug: "empresa-beta",
      active: true,
      domains: ["beta.com.br"],
      userCount: 3,
      createdAt: T0,
      updatedAt: T0,
    },
  ];

  const users: User[] = [
    user("u-super", null, "Sofia Super", "sofia@training-area.app", "SUPER_ADMIN"),
    user("u-admin", "inst-1", "Ana Administradora", "ana.admin@escola.edu.br", "INSTITUTION_ADMIN"),
    user("u-prof", "inst-1", "Paulo Professor", "paulo@escola.edu.br", "PROFESSOR"),
    user("u-al1", "inst-1", "Beatriz Souza", "beatriz@escola.edu.br", "ALUNO"),
    user("u-al2", "inst-1", "Carlos Lima", "carlos@escola.edu.br", "ALUNO"),
    user("u-al3", "inst-1", "Daniela Rocha", "daniela@escola.edu.br", "ALUNO"),
    user("u-al4", "inst-1", "Eduardo Alves", "eduardo@escola.edu.br", "ALUNO", false),
    user("u-al5", "inst-1", "Fernanda Costa", "fernanda@escola.edu.br", "ALUNO"),
    user("u-b-admin", "inst-2", "Bruno Beta", "bruno@beta.com.br", "INSTITUTION_ADMIN"),
    user("u-b-prof", "inst-2", "Bia Instrutora", "bia@beta.com.br", "PROFESSOR"),
    user("u-b-al1", "inst-2", "Gustavo Beta", "gustavo@beta.com.br", "ALUNO"),
  ];

  const section = (
    id: string,
    tenantId: string,
    title: string,
    body: string,
    position: number,
    level: ContentSection["level"],
    status: ContentSection["status"],
  ): ContentSection => ({
    id,
    tenantId,
    title,
    body,
    position,
    level,
    status,
    authorId: "u-prof",
    createdAt: T0,
    updatedAt: T0,
  });
  const sections: ContentSection[] = [
    section(
      "sec-1",
      "inst-1",
      "Introdução às fórmulas",
      "# Fórmulas\n\nToda fórmula começa com `=`. Exemplo: `=A1+B1`.",
      0,
      "FUNDAMENTAL",
      "PUBLISHED",
    ),
    section(
      "sec-2",
      "inst-1",
      "SOMA e MÉDIA",
      "Use `=SOMA(A1:A3)` para somar e `=MÉDIA(A1:A3)` para a média.",
      1,
      "FUNDAMENTAL",
      "DRAFT",
    ),
    section(
      "sec-3",
      "inst-1",
      "PROCV e PROCX",
      "Buscas em tabelas com `PROCV` e `PROCX`.",
      2,
      "PROFESSIONAL",
      "DRAFT",
    ),
    section(
      "sec-b1",
      "inst-2",
      "Boas-vindas Beta",
      "Conteúdo da Empresa Beta.",
      0,
      null,
      "PUBLISHED",
    ),
  ];

  const sets: ExerciseSet[] = [
    {
      id: "set-1",
      tenantId: "inst-1",
      name: "Trilha Fundamental",
      description: "Primeiros passos com fórmulas.",
      levels: ["FUNDAMENTAL", "PROFESSIONAL"],
      difficulties: ["VERY_EASY", "EASY", "MEDIUM"],
      quantities: [
        { level: "FUNDAMENTAL", difficulty: "VERY_EASY", quantity: 1 },
        { level: "FUNDAMENTAL", difficulty: "EASY", quantity: 1 },
        { level: "PROFESSIONAL", difficulty: "MEDIUM", quantity: 1 },
      ],
      overrides: [
        { id: "ov-1", targetType: "STUDENT", targetId: "u-al3", level: "FUNDAMENTAL", quantity: 1 },
      ],
      status: "PUBLISHED",
      authorId: "u-prof",
      createdAt: T0,
      updatedAt: T0,
    },
  ];

  const exercise = (id: string, c: ExerciseContent, bankItemId: string | null): Exercise => ({
    id,
    tenantId: "inst-1",
    setId: "set-1",
    status: "PUBLISHED",
    bankItemId,
    ...structuredClone(c),
    createdAt: T0,
    updatedAt: T0,
  });
  const exercises: Exercise[] = [
    exercise("ex-1", sumContent, "bank-1"),
    exercise("ex-2", avgContent, "bank-2"),
    exercise("ex-3", vlookupContent, "bank-4"),
  ];

  const bank: BankExercise[] = [
    bankItem("bank-1", sumContent, ["SOMA"]),
    bankItem("bank-2", avgContent, ["MÉDIA"]),
    bankItem(
      "bank-3",
      {
        title: "Maior venda",
        statement: "Em C6, mostre o maior valor de C1:C5.",
        level: "FUNDAMENTAL",
        difficulty: "EASY",
        grid: {
          rows: 7,
          cols: 4,
          cells: {
            C1: { value: 5, locked: true },
            C2: { value: 12, locked: true },
            C3: { value: 9, locked: true },
            C4: { value: 3, locked: true },
            C5: { value: 7, locked: true },
          },
        },
        answers: { C6: { kind: "FORMULA", expected: { f: "=MÁXIMO(C1:C5)" } } },
        hint: "Existe uma função para o maior valor.",
      },
      ["MÁXIMO"],
    ),
    bankItem("bank-4", vlookupContent, ["PROCV"]),
    bankItem(
      "bank-5",
      {
        title: "Aprovado ou reprovado",
        statement: "Em B2, escreva Aprovado se A2 for maior ou igual a 6; senão, Reprovado.",
        level: "PROFESSIONAL",
        difficulty: "EASY",
        grid: {
          rows: 4,
          cols: 3,
          cells: { A1: { value: "Nota", locked: true }, A2: { value: 7, locked: true } },
        },
        answers: { B2: { kind: "FORMULA", expected: { f: '=SE(A2>=6;"Aprovado";"Reprovado")' } } },
        hint: "Use SE.",
      },
      ["SE"],
    ),
    bankItem(
      "bank-6",
      {
        title: "Soma condicional por região",
        statement: "Em E2, some as vendas (B2:B6) da região escrita em D2.",
        level: "ADVANCED",
        difficulty: "HARD",
        grid: {
          rows: 7,
          cols: 5,
          cells: {
            A2: { value: "Sul", locked: true },
            A3: { value: "Norte", locked: true },
            A4: { value: "Sul", locked: true },
            B2: { value: 100, locked: true },
            B3: { value: 50, locked: true },
            B4: { value: 70, locked: true },
            D2: { value: "Sul", locked: true },
          },
        },
        answers: { E2: { kind: "VALUE", expected: 170, tolerance: 0 } },
        hint: "SOMASE recebe intervalo, critério e intervalo de soma.",
      },
      ["SOMASE"],
    ),
    bankItem(
      "bank-7",
      {
        title: "Índice e corresp",
        statement: "Em F2, use ÍNDICE e CORRESP para achar o preço do código em E2.",
        level: "ADVANCED",
        difficulty: "VERY_HARD",
        grid: {
          rows: 5,
          cols: 6,
          cells: {
            A1: { value: "Código", locked: true },
            B1: { value: "Preço", locked: true },
            A2: { value: "X1", locked: true },
            B2: { value: 10, locked: true },
            A3: { value: "X2", locked: true },
            B3: { value: 20, locked: true },
            E2: { value: "X2", locked: true },
          },
        },
        answers: { F2: { kind: "FORMULA", expected: { f: "=ÍNDICE(B2:B3;CORRESP(E2;A2:A3;0))" } } },
        hint: null,
      },
      ["ÍNDICE", "CORRESP"],
    ),
    bankItem(
      "bank-i1",
      {
        title: "Desconto de 10%",
        statement: "Em B2, calcule o preço de A2 com 10% de desconto.",
        level: "FUNDAMENTAL",
        difficulty: "MEDIUM",
        grid: {
          rows: 3,
          cols: 2,
          cells: { A1: { value: "Preço", locked: true }, A2: { value: 200, locked: true } },
        },
        answers: { B2: { kind: "VALUE", expected: 180, tolerance: 0.01 } },
        hint: null,
      },
      ["porcentagem"],
      "inst-1",
    ),
    bankItem("bank-b1", sumContent, ["beta"], "inst-2"),
  ];

  const at = (
    id: string,
    studentId: string,
    ex: Exercise,
    correct: boolean,
    submittedAt: string,
    value: string,
    attemptNumber: number,
    levelAttempt = 1,
  ): MockDb["attempts"][number] => ({
    id,
    tenantId: "inst-1",
    studentId,
    exerciseId: ex.id,
    exerciseTitle: ex.title,
    setId: ex.setId,
    level: ex.level,
    difficulty: ex.difficulty,
    levelAttempt,
    submitted: { [Object.keys(ex.answers)[0]]: parseCellInput(value) },
    correct,
    attemptNumber,
    submittedAt,
  });
  const [e1, e2, e3] = exercises;
  const attempts: MockDb["attempts"] = [
    at("a-1", "u-al1", e1, false, "2026-11-12T14:05:00.000Z", "=SOMA(A1:A2)", 1),
    at("a-2", "u-al1", e1, true, "2026-11-12T14:07:00.000Z", "=SOMA(A1:A3)", 2),
    at("a-3", "u-al1", e2, true, "2026-11-13T15:00:00.000Z", "=MÉDIA(B1:B4)", 1),
    at("a-4", "u-al1", e3, false, "2026-11-18T16:20:00.000Z", "=PROCV(D1;A1:B2;1;FALSO)", 1),
    at("a-5", "u-al2", e1, false, "2026-11-14T12:00:00.000Z", "=A1+A2", 1),
    at("a-6", "u-al2", e2, false, "2026-11-14T12:10:00.000Z", "=SOMA(B1:B4)", 1),
    at("a-7", "u-al3", e1, true, "2026-11-19T18:30:00.000Z", "=SOMA(A1:A3)", 1),
  ];

  const progress: MockDb["progress"] = [
    {
      tenantId: "inst-1",
      studentId: "u-al1",
      setId: "set-1",
      level: "FUNDAMENTAL",
      levelAttempt: 1,
      done: 2,
      correct: 2,
      required: 2,
      status: "COMPLETED",
      concept: "D",
      completedAt: "2026-11-13T15:00:00.000Z",
      history: [
        {
          levelAttempt: 1,
          done: 2,
          correct: 2,
          concept: "D",
          completedAt: "2026-11-13T15:00:00.000Z",
        },
      ],
    },
    {
      tenantId: "inst-1",
      studentId: "u-al1",
      setId: "set-1",
      level: "PROFESSIONAL",
      levelAttempt: 1,
      done: 1,
      correct: 0,
      required: 1,
      status: "IN_PROGRESS",
      concept: null,
      completedAt: null,
      history: [{ levelAttempt: 1, done: 1, correct: 0, concept: null, completedAt: null }],
    },
    {
      tenantId: "inst-1",
      studentId: "u-al2",
      setId: "set-1",
      level: "FUNDAMENTAL",
      levelAttempt: 1,
      done: 2,
      correct: 0,
      required: 2,
      status: "COMPLETED",
      concept: "ND",
      completedAt: "2026-11-14T12:10:00.000Z",
      history: [
        {
          levelAttempt: 1,
          done: 2,
          correct: 0,
          concept: "ND",
          completedAt: "2026-11-14T12:10:00.000Z",
        },
      ],
    },
    {
      tenantId: "inst-1",
      studentId: "u-al3",
      setId: "set-1",
      level: "FUNDAMENTAL",
      levelAttempt: 1,
      done: 1,
      correct: 1,
      required: 1,
      status: "COMPLETED",
      concept: "PD",
      completedAt: "2026-11-19T18:30:00.000Z",
      history: [
        {
          levelAttempt: 1,
          done: 1,
          correct: 1,
          concept: "PD",
          completedAt: "2026-11-19T18:30:00.000Z",
        },
      ],
    },
  ];

  const review = (
    id: string,
    studentId: string,
    studentName: string,
    concept: ReviewFeedback["concept"],
    accuracyPercent: number,
    text: string,
    status: ReviewFeedback["status"],
    createdAt: string,
  ): ReviewFeedback => ({
    id,
    tenantId: "inst-1",
    studentId,
    studentName,
    setId: "set-1",
    setName: "Trilha Fundamental",
    level: "FUNDAMENTAL",
    levelAttempt: 1,
    concept,
    accuracyPercent,
    generationStatus: "GENERATED",
    generationError: null,
    aiText: text,
    strengths: concept === "ND" ? [] : ["Usa referências de intervalo corretamente."],
    toReview: concept === "PD" ? [] : ["Intervalos completos em SOMA e MÉDIA."],
    finalText: text,
    status,
    rejectionReason: null,
    reviewerId: status === "DRAFT" ? null : "u-prof",
    reviewedAt: status === "DRAFT" ? null : "2026-11-15T10:00:00.000Z",
    createdAt,
  });
  const reviews: ReviewFeedback[] = [
    review(
      "rv-1",
      "u-al2",
      "Carlos Lima",
      "ND",
      0,
      'Carlos, você ainda não acertou os exercícios de SOMA e MÉDIA. O erro mais frequente foi o intervalo incompleto (A1:A2 em vez de A1:A3). Revise a seção "SOMA e MÉDIA" e refaça o nível.',
      "DRAFT",
      "2026-11-14T12:11:00.000Z",
    ),
    review(
      "rv-2",
      "u-al3",
      "Daniela Rocha",
      "PD",
      100,
      "Daniela, excelente! Você acertou todos os exercícios na primeira tentativa. Siga para o nível Profissional.",
      "DRAFT",
      "2026-11-19T18:31:00.000Z",
    ),
    review(
      "rv-3",
      "u-al1",
      "Beatriz Souza",
      "D",
      100,
      "Beatriz, bom trabalho no nível Fundamental. Você corrigiu rapidamente o intervalo da SOMA.",
      "APPROVED",
      "2026-11-13T15:01:00.000Z",
    ),
    {
      ...review(
        "rv-4",
        "u-al4",
        "Eduardo Alves",
        "ED",
        60,
        "",
        "DRAFT",
        "2026-11-20T09:00:00.000Z",
      ),
      generationStatus: "FAILED",
      generationError: "O provedor de IA não respondeu a tempo.",
      aiText: null,
      strengths: [],
      toReview: [],
      finalText: "",
    },
  ];

  return {
    version: MOCK_DB_VERSION,
    institutions,
    users,
    settings: [
      {
        tenantId: "inst-1",
        instanceName: "Escola Exemplo — Excel",
        openSignup: false,
        locale: "pt-BR",
        updatedAt: T0,
      },
      {
        tenantId: "inst-2",
        instanceName: "Beta Academy",
        openSignup: true,
        locale: "pt-BR",
        updatedAt: T0,
      },
    ],
    sections,
    sets,
    exercises,
    bank,
    feedback: [],
    reviews,
    attempts,
    progress,
    classrooms: [
      {
        id: "tur-1",
        tenantId: "inst-1",
        name: "Turma piloto",
        studentIds: ["u-al1", "u-al2", "u-al3"],
      },
    ],
  };
}
