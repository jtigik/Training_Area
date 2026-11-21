import type {
  Attempt,
  Classroom,
  ContentSection,
  Exercise,
  ExerciseSet,
  FeedbackTemplate,
  InstanceConfig,
  LevelProgress,
  User,
} from "../../domain/types";

const T0 = "2026-11-10T13:00:00.000Z";

export interface MockDb {
  users: User[];
  instance: InstanceConfig;
  sections: ContentSection[];
  sets: ExerciseSet[];
  exercises: Exercise[];
  feedback: FeedbackTemplate[];
  attempts: Attempt[];
  progress: LevelProgress[];
  classrooms: Classroom[];
}

function user(id: string, name: string, email: string, role: User["role"], active = true): User {
  return { id, name, email, role, active, createdAt: T0, updatedAt: T0 };
}

export const DEFAULT_FEEDBACK: FeedbackTemplate = {
  setId: null,
  updatedAt: T0,
  bands: [
    {
      id: "fb-def-1",
      minPercent: 0,
      maxPercent: 50,
      label: "Precisa revisar",
      template:
        "{{nome}}, você concluiu o nível {{nivel}} com {{acertos}} de {{total}} acertos ({{percentual}}). Revise as seções do nível e tente de novo os exercícios em que errou.",
    },
    {
      id: "fb-def-2",
      minPercent: 51,
      maxPercent: 80,
      label: "Bom caminho",
      template:
        "Bom trabalho, {{nome}}! {{acertos}} de {{total}} acertos ({{percentual}}) no nível {{nivel}}. Pratique os intervalos e referências para chegar lá.",
    },
    {
      id: "fb-def-3",
      minPercent: 81,
      maxPercent: 100,
      label: "Excelente",
      template:
        "Excelente, {{nome}}! Você dominou o nível {{nivel}} com {{percentual}} de acerto. Siga para o próximo nível.",
    },
  ],
};

export function createSeed(): MockDb {
  const users: User[] = [
    user("u-admin", "Ana Administradora", "ana.admin@training.local", "ADMIN"),
    user("u-prof", "Paulo Professor", "paulo@training.local", "TEACHER"),
    user("u-al1", "Beatriz Souza", "beatriz@aluno.local", "STUDENT"),
    user("u-al2", "Carlos Lima", "carlos@aluno.local", "STUDENT"),
    user("u-al3", "Daniela Rocha", "daniela@aluno.local", "STUDENT"),
    user("u-al4", "Eduardo Alves", "eduardo@aluno.local", "STUDENT", false),
    user("u-al5", "Fernanda Costa", "fernanda@aluno.local", "STUDENT"),
  ];

  const sections: ContentSection[] = [
    {
      id: "sec-1",
      title: "Introdução às fórmulas",
      body: "# Fórmulas\n\nToda fórmula começa com `=`. Exemplo: `=A1+B1`.",
      order: 0,
      level: "fundamental",
      status: "publicado",
      authorId: "u-prof",
      createdAt: T0,
      updatedAt: T0,
    },
    {
      id: "sec-2",
      title: "SOMA e MÉDIA",
      body: "Use `=SOMA(A1:A3)` para somar e `=MÉDIA(A1:A3)` para a média.",
      order: 1,
      level: "fundamental",
      status: "rascunho",
      authorId: "u-prof",
      createdAt: T0,
      updatedAt: T0,
    },
    {
      id: "sec-3",
      title: "PROCV e PROCX",
      body: "Buscas em tabelas com `PROCV` e `PROCX`.",
      order: 2,
      level: "profissional",
      status: "rascunho",
      authorId: "u-prof",
      createdAt: T0,
      updatedAt: T0,
    },
  ];

  const sets: ExerciseSet[] = [
    {
      id: "set-1",
      name: "Trilha Fundamental",
      description: "Primeiros passos com fórmulas.",
      levels: ["fundamental", "profissional"],
      difficulties: ["muito_facil", "facil", "medio"],
      quantities: [
        { level: "fundamental", difficulty: null, quantity: 2 },
        { level: "profissional", difficulty: null, quantity: 1 },
      ],
      overrides: [
        { id: "ov-1", targetType: "aluno", targetId: "u-al3", level: "fundamental", quantity: 1 },
      ],
      status: "publicado",
      authorId: "u-prof",
      createdAt: T0,
      updatedAt: T0,
    },
  ];

  const exercises: Exercise[] = [
    {
      id: "ex-1",
      setId: "set-1",
      title: "Somar vendas",
      statement: "Some os valores de A1 a A3 na célula A4.",
      level: "fundamental",
      difficulty: "muito_facil",
      grid: {
        rows: 6,
        cols: 4,
        cells: {
          A1: { value: "10", locked: true },
          A2: { value: "20", locked: true },
          A3: { value: "30", locked: true },
        },
      },
      answers: { A4: { kind: "valor", expected: "60", tolerance: 0 } },
      hint: "Use a função SOMA.",
      published: true,
      createdAt: T0,
      updatedAt: T0,
    },
    {
      id: "ex-2",
      setId: "set-1",
      title: "Média de notas",
      statement: "Calcule em B5 a média de B1:B4.",
      level: "fundamental",
      difficulty: "facil",
      grid: {
        rows: 6,
        cols: 4,
        cells: {
          B1: { value: "7", locked: true },
          B2: { value: "8", locked: true },
          B3: { value: "6", locked: true },
          B4: { value: "9", locked: true },
        },
      },
      answers: { B5: { kind: "formula", expected: "=MÉDIA(B1:B4)" } },
      hint: null,
      published: true,
      createdAt: T0,
      updatedAt: T0,
    },
    {
      id: "ex-3",
      setId: "set-1",
      title: "Busca de preço",
      statement: "Use PROCV para achar o preço do produto em D1.",
      level: "profissional",
      difficulty: "medio",
      grid: {
        rows: 6,
        cols: 4,
        cells: {
          A1: { value: "Caneta", locked: true },
          B1: { value: "2,5", locked: true },
          A2: { value: "Lápis", locked: true },
          B2: { value: "1,2", locked: true },
          D1: { value: "Lápis", locked: true },
        },
      },
      answers: { D2: { kind: "formula", expected: "=PROCV(D1;A1:B2;2;FALSO)" } },
      hint: "Quarto argumento FALSO = correspondência exata.",
      published: true,
      createdAt: T0,
      updatedAt: T0,
    },
  ];

  const at = (
    id: string,
    studentId: string,
    ex: Exercise,
    correct: boolean,
    submittedAt: string,
    value: string,
  ): Attempt => ({
    id,
    studentId,
    exerciseId: ex.id,
    exerciseTitle: ex.title,
    setId: ex.setId,
    level: ex.level,
    difficulty: ex.difficulty,
    submitted: { [Object.keys(ex.answers)[0]]: value },
    correct,
    submittedAt,
  });

  const [e1, e2, e3] = exercises;
  const attempts: Attempt[] = [
    at("a-1", "u-al1", e1, false, "2026-11-12T14:05:00.000Z", "=SOMA(A1:A2)"),
    at("a-2", "u-al1", e1, true, "2026-11-12T14:07:00.000Z", "=SOMA(A1:A3)"),
    at("a-3", "u-al1", e2, true, "2026-11-13T15:00:00.000Z", "=MÉDIA(B1:B4)"),
    at("a-4", "u-al1", e3, false, "2026-11-18T16:20:00.000Z", "=PROCV(D1;A1:B2;1;FALSO)"),
    at("a-5", "u-al2", e1, true, "2026-11-14T12:00:00.000Z", "=A1+A2+A3"),
    at("a-6", "u-al3", e1, true, "2026-11-19T18:30:00.000Z", "=SOMA(A1:A3)"),
  ];

  const progress: LevelProgress[] = [
    {
      studentId: "u-al1",
      setId: "set-1",
      level: "fundamental",
      done: 2,
      correct: 2,
      required: 2,
      status: "concluido",
      completedAt: "2026-11-13T15:00:00.000Z",
    },
    {
      studentId: "u-al1",
      setId: "set-1",
      level: "profissional",
      done: 0,
      correct: 0,
      required: 1,
      status: "em_andamento",
      completedAt: null,
    },
    {
      studentId: "u-al2",
      setId: "set-1",
      level: "fundamental",
      done: 1,
      correct: 1,
      required: 2,
      status: "em_andamento",
      completedAt: null,
    },
    {
      studentId: "u-al3",
      setId: "set-1",
      level: "fundamental",
      done: 1,
      correct: 1,
      required: 1,
      status: "concluido",
      completedAt: "2026-11-19T18:30:00.000Z",
    },
  ];

  return {
    users,
    instance: { name: "Training Area", openSignup: false, locale: "pt-BR", updatedAt: T0 },
    sections,
    sets,
    exercises,
    feedback: [structuredClone(DEFAULT_FEEDBACK)],
    attempts,
    progress,
    classrooms: [{ id: "tur-1", name: "Turma piloto", studentIds: ["u-al1", "u-al2", "u-al3"] }],
  };
}
