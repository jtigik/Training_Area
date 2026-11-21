import type {
  Difficulty,
  ExerciseSetStatus,
  Level,
  ProgressStatus,
  Role,
  SectionStatus,
} from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Aluno",
  TEACHER: "Professor",
  ADMIN: "Administrador",
};

export const activeLabel = (active: boolean) => (active ? "Ativo" : "Inativo");

export const LEVEL_LABELS: Record<Level, string> = {
  fundamental: "Fundamental",
  profissional: "Profissional",
  avancado: "Avançado",
  dashboard: "Dashboard",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  muito_facil: "Muito fácil",
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
  muito_dificil: "Muito difícil",
};

export const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  arquivado: "Arquivado",
};

export const SET_STATUS_LABELS: Record<ExerciseSetStatus, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
};

export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};
