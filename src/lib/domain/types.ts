/**
 * Tipos de domínio das áreas do professor, do admin da instituição e do super admin.
 *
 * Valores de enum em inglês, iguais aos enums do Prisma (prisma/schema.prisma,
 * branch do Backend 1); rótulos pt-BR em ./labels.ts. Os Backends 1 e 2 devem
 * expor DTOs JSON com estes formatos (datas em ISO 8601 UTC).
 *
 * Multi-tenant: toda entidade de uma instituição carrega `tenantId`.
 * O escopo vem da sessão no servidor; o cliente nunca escolhe o tenant,
 * exceto o SUPER_ADMIN na gestão de instituições.
 */

export const ROLES = ["SUPER_ADMIN", "INSTITUTION_ADMIN", "PROFESSOR", "ALUNO"] as const;
export type Role = (typeof ROLES)[number];
/** Papéis que o admin da instituição pode atribuir. */
export const INSTITUTION_ROLES = [
  "INSTITUTION_ADMIN",
  "PROFESSOR",
  "ALUNO",
] as const satisfies readonly Role[];
export type InstitutionRole = (typeof INSTITUTION_ROLES)[number];

export const LEVELS = ["FUNDAMENTAL", "PROFESSIONAL", "ADVANCED", "DASHBOARD"] as const;
export type Level = (typeof LEVELS)[number];
/** Níveis expostos no MVP. DASHBOARD fica para a v1.1. */
export const MVP_LEVELS = [
  "FUNDAMENTAL",
  "PROFESSIONAL",
  "ADVANCED",
] as const satisfies readonly Level[];
export type MvpLevel = (typeof MVP_LEVELS)[number];

export const DIFFICULTIES = ["VERY_EASY", "EASY", "MEDIUM", "HARD", "VERY_HARD"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const PUBLICATION_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export type SectionStatus = PublicationStatus;
export type ExerciseSetStatus = Exclude<PublicationStatus, "ARCHIVED">;

export const PROGRESS_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

/** Conceitos: Não Demonstrou, Em Desenvolvimento, Demonstrou, Plenamente Demonstrou. */
export const CONCEPTS = ["ND", "ED", "D", "PD"] as const;
export type Concept = (typeof CONCEPTS)[number];
/** Conceitos que permitem refazer o nível. */
export const REDO_CONCEPTS: readonly Concept[] = ["ND", "ED"];

export const REVIEW_STATUSES = ["DRAFT", "APPROVED", "REJECTED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Situação da geração por IA (independente da revisão). */
export const GENERATION_STATUSES = ["PENDING", "GENERATED", "FAILED"] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

/** ISO 8601 (UTC) string. */
export type IsoDateTime = string;

export interface Institution {
  id: string;
  name: string;
  /** Identificador curto e único (URL/subdomínio). */
  slug: string;
  active: boolean;
  /** Domínios de e-mail aceitos no login Google/Microsoft (ex.: "escola.edu.br"). */
  domains: string[];
  userCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface User {
  id: string;
  /** `null` apenas para SUPER_ADMIN. */
  tenantId: string | null;
  name: string;
  email: string;
  role: Role;
  /** Usuário inativo não autentica. */
  active: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ContentSection {
  id: string;
  tenantId: string;
  title: string;
  /** Corpo em Markdown. */
  body: string;
  /** Posição na navegação (0 = primeira). */
  position: number;
  /** `null` = conteúdo transversal (TA-012). */
  level: Level | null;
  status: SectionStatus;
  authorId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Endereço de célula estilo planilha, ex.: "A1", "C12". */
export type CellAddress = string;

/** Valor literal de célula (JSON nativo). `null` = vazia. */
export type CellScalar = number | string | boolean | null;

/** Célula com fórmula. `f` sempre começa com "="; `v` é o resultado em cache, quando houver. */
export interface FormulaCell {
  f: string;
  v?: CellScalar;
}

/**
 * Conteúdo de célula combinado com BE1/BE2/FE1: `number | string | boolean | null | { f, v? }`.
 * Fórmula só existe em `{ f }`; uma string que começa com "=" é texto literal.
 * O número 10 e o texto "10" são diferentes (QA TC-036-02).
 */
export type CellValue = CellScalar | FormulaCell;

/** Célula da planilha inicial. */
export interface GridCell {
  value: CellValue;
  /** Célula bloqueada para o aluno (dados/enunciado). */
  locked: boolean;
}

/** Derivado de `expected`: FORMULA quando é `{ f }`, VALUE caso contrário. */
export type AnswerKind = "VALUE" | "FORMULA";

/** Célula de gabarito (resultado esperado). Nunca enviada ao aluno. */
export interface AnswerCell {
  kind: AnswerKind;
  /** Valor esperado tipado (ex.: 150, "Aprovado", true) ou fórmula esperada ({ f: "=SOMA(A1:A3)" }). */
  expected: CellValue;
  /** Tolerância numérica absoluta para comparação por valor. */
  tolerance?: number;
}

export interface SpreadsheetGrid {
  rows: number;
  cols: number;
  cells: Record<CellAddress, GridCell>;
}

/** Conteúdo autoral de um exercício (comum a exercício de conjunto e item do banco). */
export interface ExerciseContent {
  title: string;
  /** Enunciado em Markdown. */
  statement: string;
  level: Level;
  difficulty: Difficulty;
  grid: SpreadsheetGrid;
  answers: Record<CellAddress, AnswerCell>;
  hint: string | null;
}

export interface Exercise extends ExerciseContent {
  id: string;
  tenantId: string;
  setId: string;
  status: ExerciseSetStatus;
  /** Item do banco de origem, quando o exercício foi copiado do banco. */
  bankItemId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type BankOrigin = "PLATFORM" | "INSTITUTION";
export type BankSource = "SEED" | "EDITOR" | "XLSX";

/**
 * Item do banco de exercícios. `tenantId = null` = banco inicial da
 * plataforma (somente leitura para professores); itens da instituição podem
 * ser editados pelos professores dela.
 */
export interface BankExercise extends ExerciseContent {
  id: string;
  tenantId: string | null;
  origin: BankOrigin;
  source: BankSource;
  /** Itens importados entram como rascunho; só itens publicados podem ir para conjuntos. */
  status: ExerciseSetStatus;
  tags: string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Quantidade de exercícios por recorte (nível, opcionalmente nível+dificuldade). */
export interface QuantityRule {
  level: Level;
  /** `null` = vale para o nível inteiro, qualquer dificuldade. */
  difficulty: Difficulty | null;
  quantity: number;
}

export type QuantityTargetType = "STUDENT" | "CLASSROOM";

/** Exceção de quantidade para um aluno ou uma turma (precedência: aluno > turma > padrão). */
export interface QuantityOverride {
  id: string;
  targetType: QuantityTargetType;
  targetId: string;
  level: Level;
  quantity: number;
}

export interface ExerciseSet {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  levels: Level[];
  difficulties: Difficulty[];
  quantities: QuantityRule[];
  overrides: QuantityOverride[];
  status: ExerciseSetStatus;
  /** Última publicação (a cópia publicada fica em SetExercise). `null` = nunca publicado. */
  publishedAt: IsoDateTime | null;
  authorId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Versão dos exercícios de um conjunto: rascunho (editável) ou cópia publicada. */
export type SetExercisesVersion = "draft" | "published";

/**
 * Cópia imutável de um exercício no conjunto publicado (BE2 `SetExercise`).
 * Publicar copia os exercícios PUBLISHED do rascunho; editar o rascunho não
 * muda o que os alunos veem até a próxima publicação.
 */
export interface SetExercise extends ExerciseContent {
  id: string;
  tenantId: string;
  setId: string;
  /** Exercício de origem no rascunho. */
  exerciseId: string;
  position: number;
  publishedAt: IsoDateTime;
}

export interface Classroom {
  id: string;
  tenantId: string;
  name: string;
  studentIds: string[];
}

/** Faixa de feedback por desempenho (TA-027). Percentuais inclusivos 0–100. */
export interface FeedbackBand {
  id: string;
  minPercent: number;
  maxPercent: number;
  label: string;
  /** Texto-base (orienta a IA e serve de fallback); aceita {{nome}}, {{nivel}}, {{acertos}}, {{total}}, {{percentual}}, {{conceito}}. */
  template: string;
}

export interface FeedbackTemplate {
  /** `null` = padrão da instituição. */
  setId: string | null;
  bands: FeedbackBand[];
  updatedAt: IsoDateTime;
}

/** Feedback gerado (IA) aguardando revisão do professor antes de chegar ao aluno. */
export interface ReviewFeedback {
  id: string;
  tenantId: string;
  studentId: string;
  studentName: string;
  setId: string;
  setName: string;
  level: Level;
  /** Número da tentativa do nível (1, 2… quando o aluno refaz). */
  levelAttempt: number;
  concept: Concept;
  accuracyPercent: number;
  /** Geração por IA: PENDING (gerando), GENERATED ou FAILED. */
  generationStatus: GenerationStatus;
  /** Motivo da falha da geração (só com FAILED). */
  generationError: string | null;
  /** Texto gerado pela IA; `null` enquanto PENDING ou quando FAILED. */
  aiText: string | null;
  /** Pontos fortes apontados pela IA. */
  strengths: string[];
  /** O que o aluno deve revisar. */
  toReview: string[];
  /** Texto final (editado pelo professor); liberado ao aluno se aprovado. */
  finalText: string;
  status: ReviewStatus;
  rejectionReason: string | null;
  reviewerId: string | null;
  reviewedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
}

export interface Attempt {
  id: string;
  studentId: string;
  exerciseId: string;
  exerciseTitle: string;
  setId: string;
  level: Level;
  difficulty: Difficulty;
  /** Tentativa do nível à qual pertence (1 = primeira vez; 2+ = refazendo). */
  levelAttempt: number;
  /** Fórmula ou valores enviados, por célula (tipados). */
  submitted: Record<CellAddress, CellValue>;
  correct: boolean;
  /** 1, 2, 3… por (aluno, exercício). */
  attemptNumber: number;
  submittedAt: IsoDateTime;
}

/** Resultado de uma passagem completa pelo nível. */
export interface LevelAttemptSummary {
  levelAttempt: number;
  done: number;
  correct: number;
  concept: Concept | null;
  completedAt: IsoDateTime | null;
}

export interface LevelProgress {
  studentId: string;
  setId: string;
  level: Level;
  /** Tentativa atual do nível (1 = primeira). */
  levelAttempt: number;
  done: number;
  correct: number;
  required: number;
  status: ProgressStatus;
  /** Conceito da tentativa atual (definido ao concluir). */
  concept: Concept | null;
  completedAt: IsoDateTime | null;
  /** Histórico de tentativas do nível, da mais antiga para a mais recente. */
  history: LevelAttemptSummary[];
}

export interface InstitutionSettings {
  tenantId: string;
  /** Nome exibido no cabeçalho e no login. */
  instanceName: string;
  /** Qualquer conta Google/Microsoft dos domínios da instituição entra como aluno. */
  openSignup: boolean;
  locale: "pt-BR";
  updatedAt: IsoDateTime;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
