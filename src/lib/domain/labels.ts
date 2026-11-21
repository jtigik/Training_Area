import type {
  Concept,
  Difficulty,
  ExerciseSetStatus,
  GenerationStatus,
  Level,
  ProgressStatus,
  ReviewStatus,
  Role,
  SectionStatus,
} from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  INSTITUTION_ADMIN: "Admin da instituição",
  PROFESSOR: "Professor",
  ALUNO: "Aluno",
};

export const activeLabel = (active: boolean) => (active ? "Ativo" : "Inativo");

export const LEVEL_LABELS: Record<Level, string> = {
  FUNDAMENTAL: "Fundamental",
  PROFESSIONAL: "Profissional",
  ADVANCED: "Avançado",
  DASHBOARD: "Dashboard",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  VERY_EASY: "Muito fácil",
  EASY: "Fácil",
  MEDIUM: "Médio",
  HARD: "Difícil",
  VERY_HARD: "Muito difícil",
};

/** Seções usam o feminino ("Publicada"). */
export const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  ARCHIVED: "Arquivada",
};

export const SET_STATUS_LABELS: Record<ExerciseSetStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
};

export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  NOT_STARTED: "Não iniciado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
};

export const CONCEPT_LABELS: Record<Concept, string> = {
  ND: "Não demonstrou",
  ED: "Em desenvolvimento",
  D: "Demonstrou",
  PD: "Plenamente demonstrou",
};

export const GENERATION_STATUS_LABELS: Record<GenerationStatus, string> = {
  PENDING: "Gerando…",
  GENERATED: "Gerado",
  FAILED: "Falha na geração",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  DRAFT: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};
