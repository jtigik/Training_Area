/**
 * Tipos de domínio da área do professor e do administrador.
 *
 * Espelham o modelo de dados do plano de produto (Usuario, SecaoConteudo,
 * ConjuntoExercicios, Exercicio, Tentativa, ProgressoNivel, Feedback,
 * ConfiguracaoInstancia). Os Backends 1 e 2 devem expor DTOs com estes
 * formatos (JSON, datas em ISO 8601 UTC).
 */

/** Mesmos valores do enum `Role` do Prisma (prisma/schema.prisma). */
export const ROLES = ["STUDENT", "TEACHER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const LEVELS = ["fundamental", "profissional", "avancado", "dashboard"] as const;
export type Level = (typeof LEVELS)[number];

export const DIFFICULTIES = ["muito_facil", "facil", "medio", "dificil", "muito_dificil"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const SECTION_STATUSES = ["rascunho", "publicado", "arquivado"] as const;
export type SectionStatus = (typeof SECTION_STATUSES)[number];

export const SET_STATUSES = ["rascunho", "publicado"] as const;
export type ExerciseSetStatus = (typeof SET_STATUSES)[number];

export const PROGRESS_STATUSES = ["nao_iniciado", "em_andamento", "concluido"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

/** ISO 8601 (UTC) string. */
export type IsoDateTime = string;

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Igual ao campo `active` do Prisma; inativo não autentica. */
  active: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ContentSection {
  id: string;
  title: string;
  /** Corpo em Markdown. */
  body: string;
  /** Posição na navegação (0 = primeira). */
  order: number;
  /** Nível opcional; `null` = conteúdo transversal (TA-012). */
  level: Level | null;
  status: SectionStatus;
  authorId: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Endereço de célula estilo planilha, ex.: "A1", "C12". */
export type CellAddress = string;

/** Célula da planilha inicial. `value` pode ser número, texto ou fórmula ("=..."). */
export interface GridCell {
  value: string;
  /** Célula bloqueada para o aluno (enunciado/dados). */
  locked: boolean;
}

export type AnswerKind = "valor" | "formula";

/** Célula de gabarito (resultado esperado). */
export interface AnswerCell {
  kind: AnswerKind;
  /** Valor esperado (ex.: "150") ou fórmula esperada (ex.: "=SOMA(A1:A3)"). */
  expected: string;
  /** Tolerância numérica absoluta para comparação por valor. */
  tolerance?: number;
}

export interface SpreadsheetGrid {
  rows: number;
  cols: number;
  cells: Record<CellAddress, GridCell>;
}

export interface Exercise {
  id: string;
  setId: string;
  title: string;
  /** Enunciado em Markdown. */
  statement: string;
  level: Level;
  difficulty: Difficulty;
  grid: SpreadsheetGrid;
  answers: Record<CellAddress, AnswerCell>;
  hint: string | null;
  published: boolean;
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

export type QuantityTargetType = "aluno" | "turma";

/**
 * Exceção de quantidade para um aluno específico ou uma turma.
 * Turmas são v1.1 (TA-037); o contrato já prevê o alvo.
 */
export interface QuantityOverride {
  id: string;
  targetType: QuantityTargetType;
  targetId: string;
  level: Level;
  quantity: number;
}

export interface ExerciseSet {
  id: string;
  name: string;
  description: string;
  levels: Level[];
  difficulties: Difficulty[];
  quantities: QuantityRule[];
  overrides: QuantityOverride[];
  status: ExerciseSetStatus;
  authorId: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Classroom {
  id: string;
  name: string;
  studentIds: string[];
}

/** Faixa de feedback por desempenho (TA-027). Percentuais inclusivos 0–100. */
export interface FeedbackBand {
  id: string;
  minPercent: number;
  maxPercent: number;
  label: string;
  /** Texto-base; aceita variáveis {{nome}}, {{nivel}}, {{acertos}}, {{total}}, {{percentual}}. */
  template: string;
}

export interface FeedbackTemplate {
  /** `null` = conjunto padrão da plataforma. */
  setId: string | null;
  bands: FeedbackBand[];
  updatedAt: IsoDateTime;
}

export interface Attempt {
  id: string;
  studentId: string;
  exerciseId: string;
  exerciseTitle: string;
  setId: string;
  level: Level;
  difficulty: Difficulty;
  /** Fórmula ou valores enviados, por célula. */
  submitted: Record<CellAddress, string>;
  correct: boolean;
  submittedAt: IsoDateTime;
}

export interface LevelProgress {
  studentId: string;
  setId: string;
  level: Level;
  done: number;
  correct: number;
  required: number;
  status: ProgressStatus;
  completedAt: IsoDateTime | null;
}

export interface InstanceConfig {
  name: string;
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
