import { Badge } from "@/components/ui/badge";
import {
  CONCEPT_LABELS,
  DIFFICULTY_LABELS,
  LEVEL_LABELS,
  PROGRESS_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  ROLE_LABELS,
  SECTION_STATUS_LABELS,
  SET_STATUS_LABELS,
} from "@/lib/domain/labels";
import type {
  Concept,
  Difficulty,
  ExerciseSetStatus,
  Level,
  ProgressStatus,
  ReviewStatus,
  Role,
  SectionStatus,
} from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/* Cores dos tokens do design (design/tokens): níveis, dificuldade 1–5 e semânticas. */
const LEVEL_CLASSES: Record<Level, string> = {
  FUNDAMENTAL: "bg-level-fundamental-subtle text-level-fundamental-subtle-foreground",
  PROFESSIONAL: "bg-level-profissional-subtle text-level-profissional-subtle-foreground",
  ADVANCED: "bg-level-avancado-subtle text-level-avancado-subtle-foreground",
  DASHBOARD: "bg-level-dashboard-subtle text-level-dashboard-subtle-foreground",
};

const DIFFICULTY_CLASSES: Record<Difficulty, string> = {
  VERY_EASY: "bg-diff-1 text-diff-1-foreground",
  EASY: "bg-diff-2 text-diff-2-foreground",
  MEDIUM: "bg-diff-3 text-diff-3-foreground",
  HARD: "bg-diff-4 text-diff-4-foreground",
  VERY_HARD: "bg-diff-5 text-diff-5-foreground",
};

const NEUTRAL = "bg-muted text-muted-foreground";
const SUCCESS = "bg-success-subtle text-success-subtle-foreground";
const WARNING = "bg-warning-subtle text-warning-subtle-foreground";
const ERROR = "bg-error-subtle text-error-subtle-foreground";
const INFO = "bg-info-subtle text-info-subtle-foreground";

const PUBLICATION_CLASSES: Record<SectionStatus, string> = {
  DRAFT: NEUTRAL,
  PUBLISHED: SUCCESS,
  ARCHIVED: "bg-secondary text-secondary-foreground",
};
const PROGRESS_CLASSES: Record<ProgressStatus, string> = {
  NOT_STARTED: NEUTRAL,
  IN_PROGRESS: WARNING,
  COMPLETED: SUCCESS,
};
const CONCEPT_CLASSES: Record<Concept, string> = { ND: ERROR, ED: WARNING, D: INFO, PD: SUCCESS };
const REVIEW_CLASSES: Record<ReviewStatus, string> = {
  PENDING: WARNING,
  APPROVED: SUCCESS,
  REJECTED: ERROR,
};

function Pill({
  className,
  children,
  title,
}: {
  className: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Badge variant="outline" title={title} className={cn("border-transparent", className)}>
      {children}
    </Badge>
  );
}

export const LevelBadge = ({ level }: { level: Level }) => (
  <Pill className={LEVEL_CLASSES[level]}>{LEVEL_LABELS[level]}</Pill>
);

export const DifficultyBadge = ({ difficulty }: { difficulty: Difficulty }) => (
  <Pill className={DIFFICULTY_CLASSES[difficulty]}>{DIFFICULTY_LABELS[difficulty]}</Pill>
);

export const SectionStatusBadge = ({ status }: { status: SectionStatus }) => (
  <Pill className={PUBLICATION_CLASSES[status]}>{SECTION_STATUS_LABELS[status]}</Pill>
);

export const SetStatusBadge = ({ status }: { status: ExerciseSetStatus }) => (
  <Pill className={PUBLICATION_CLASSES[status]}>{SET_STATUS_LABELS[status]}</Pill>
);

export const ProgressBadge = ({ status }: { status: ProgressStatus }) => (
  <Pill className={PROGRESS_CLASSES[status]}>{PROGRESS_STATUS_LABELS[status]}</Pill>
);

export const ReviewStatusBadge = ({ status }: { status: ReviewStatus }) => (
  <Pill className={REVIEW_CLASSES[status]}>{REVIEW_STATUS_LABELS[status]}</Pill>
);

/** Conceito: o texto é exatamente o código (ND, ED, D, PD); o nome por extenso vai no title. */
export function ConceptBadge({ concept }: { concept: Concept }) {
  return (
    <Badge
      variant="outline"
      data-testid="concept-badge"
      title={CONCEPT_LABELS[concept]}
      className={cn("border-transparent font-mono", CONCEPT_CLASSES[concept])}
    >
      {concept}
    </Badge>
  );
}

export const RoleBadge = ({ role }: { role: Role }) => (
  <Badge variant={role === "INSTITUTION_ADMIN" || role === "SUPER_ADMIN" ? "default" : "secondary"}>
    {ROLE_LABELS[role]}
  </Badge>
);

export const ActiveBadge = ({ active }: { active: boolean }) => (
  <Pill className={active ? SUCCESS : NEUTRAL}>{active ? "Ativo" : "Inativo"}</Pill>
);
