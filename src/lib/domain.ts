/**
 * Enums de domínio (espelham o schema Prisma) e rótulos pt-BR.
 * Arquivo puro: pode ser usado no cliente e no servidor.
 */
export const KNOWLEDGE_LEVELS = ["FUNDAMENTAL", "PROFESSIONAL", "ADVANCED", "DASHBOARD"] as const;
export type KnowledgeLevel = (typeof KNOWLEDGE_LEVELS)[number];

export const KNOWLEDGE_LEVEL_LABELS: Record<KnowledgeLevel, string> = {
  FUNDAMENTAL: "Fundamental",
  PROFESSIONAL: "Profissional",
  ADVANCED: "Avançado",
  DASHBOARD: "Dashboard",
};

/**
 * Níveis liberados no MVP. DASHBOARD existe no enum (reservado para v1.1),
 * mas não pode ser criado/selecionado agora.
 */
export const MVP_LEVELS = [
  "FUNDAMENTAL",
  "PROFESSIONAL",
  "ADVANCED",
] as const satisfies readonly KnowledgeLevel[];
export type MvpLevel = (typeof MVP_LEVELS)[number];

export function isMvpLevel(value: unknown): value is MvpLevel {
  return typeof value === "string" && (MVP_LEVELS as readonly string[]).includes(value);
}

/** Opções de nível para a UI do MVP (sem Dashboard). */
export const SELECTABLE_LEVEL_OPTIONS: ReadonlyArray<{ value: MvpLevel; label: string }> =
  MVP_LEVELS.map((value) => ({ value, label: KNOWLEDGE_LEVEL_LABELS[value] }));

export const LEVEL_NOT_AVAILABLE_IN_MVP = "O nível Dashboard estará disponível apenas na v1.1";

export const DIFFICULTIES = ["VERY_EASY", "EASY", "MEDIUM", "HARD", "VERY_HARD"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  VERY_EASY: "Muito fácil",
  EASY: "Fácil",
  MEDIUM: "Médio",
  HARD: "Difícil",
  VERY_HARD: "Muito difícil",
};

export const PUBLICATION_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

/** Conceito formal do nível. Rótulos: premissa a confirmar com o PO. */
export const GRADE_CONCEPTS = ["ND", "ED", "D", "PD"] as const;
export type GradeConcept = (typeof GRADE_CONCEPTS)[number];

export const GRADE_CONCEPT_LABELS: Record<GradeConcept, string> = {
  ND: "Não demonstrado",
  ED: "Em desenvolvimento",
  D: "Demonstrado",
  PD: "Plenamente demonstrado",
};

export const LEVEL_ATTEMPT_STATUSES = ["IN_PROGRESS", "COMPLETED", "ABANDONED"] as const;
export type LevelAttemptStatus = (typeof LEVEL_ATTEMPT_STATUSES)[number];

export const FEEDBACK_STATUSES = ["DRAFT", "APPROVED", "REJECTED"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Geração do feedback pela IA (independente da revisão). */
export const FEEDBACK_GENERATION_STATUSES = ["PENDING", "GENERATED", "FAILED"] as const;
export type FeedbackGenerationStatus = (typeof FEEDBACK_GENERATION_STATUSES)[number];

export const EXERCISE_IMPORT_STATUSES = ["PROCESSING", "COMPLETED", "FAILED"] as const;
export type ExerciseImportStatus = (typeof EXERCISE_IMPORT_STATUSES)[number];
