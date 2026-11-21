import {
  DIFFICULTY_LABELS,
  DIFFICULTY_RANK,
  EXERCISE_STATUS_LABELS,
  LEVEL_LABELS,
  LEVEL_STATUS_LABELS,
  type Concept,
  type Difficulty,
  type ExerciseStatus,
  type KnowledgeLevel,
  type LevelStatus,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const pill = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium";

const LEVEL_STATUS_STYLE: Record<LevelStatus, { icon: string; className: string }> = {
  COMPLETED: { icon: "✓", className: "bg-success-subtle text-success-subtle-foreground" },
  IN_PROGRESS: { icon: "◐", className: "bg-info-subtle text-info-subtle-foreground" },
  NOT_STARTED: { icon: "○", className: "bg-muted text-muted-foreground" },
  LOCKED: { icon: "🔒", className: "bg-muted text-muted-foreground" },
};

export function LevelStatusBadge({ status }: { status: LevelStatus }) {
  const s = LEVEL_STATUS_STYLE[status];
  return (
    <span className={cn(pill, s.className)}>
      <span aria-hidden="true">{s.icon}</span>
      {LEVEL_STATUS_LABELS[status]}
    </span>
  );
}

const EXERCISE_STATUS_STYLE: Record<ExerciseStatus, { icon: string; className: string }> = {
  CORRECT: { icon: "✓", className: "bg-success-subtle text-success-subtle-foreground" },
  INCORRECT: { icon: "✕", className: "bg-error-subtle text-error-subtle-foreground" },
  NOT_STARTED: { icon: "○", className: "bg-muted text-muted-foreground" },
};

export function ExerciseStatusBadge({ status }: { status: ExerciseStatus }) {
  const s = EXERCISE_STATUS_STYLE[status];
  return (
    <span className={cn(pill, s.className)}>
      <span aria-hidden="true">{s.icon}</span>
      {EXERCISE_STATUS_LABELS[status]}
    </span>
  );
}

export function ResultBadge({ correct }: { correct: boolean }) {
  return <ExerciseStatusBadge status={correct ? "CORRECT" : "INCORRECT"} />;
}

const DIFF_STYLE = {
  1: "bg-diff-1 text-diff-1-foreground",
  2: "bg-diff-2 text-diff-2-foreground",
  3: "bg-diff-3 text-diff-3-foreground",
  4: "bg-diff-4 text-diff-4-foreground",
  5: "bg-diff-5 text-diff-5-foreground",
} as const;

/** Difficulty with a 5-bar meter (color is never the only cue: the label is always shown). */
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const rank = DIFFICULTY_RANK[difficulty];
  return (
    <span className={cn(pill, DIFF_STYLE[rank])}>
      <span aria-hidden="true" className="flex items-end gap-px">
        {[6, 8, 10, 12, 14].map((h, i) => (
          <span
            key={h}
            className={cn("w-0.5 rounded-sm bg-current", i >= rank && "opacity-25")}
            style={{ height: h }}
          />
        ))}
      </span>
      <span>
        <span className="sr-only">Dificuldade: </span>
        {DIFFICULTY_LABELS[difficulty]}
      </span>
    </span>
  );
}

const CONCEPT_STYLE: Record<Concept, string> = {
  PD: "bg-success text-success-foreground",
  D: "bg-success-subtle text-success-subtle-foreground",
  ED: "bg-warning-subtle text-warning-subtle-foreground",
  ND: "bg-error-subtle text-error-subtle-foreground",
};

export function ConceptBadge({ concept }: { concept: Concept }) {
  return (
    <span className={cn(pill, CONCEPT_STYLE[concept])}>
      <span className="sr-only">Conceito: </span>
      {/* QA contract: data-testid="concept-badge" with text exactly ND/ED/D/PD. */}
      <span data-testid="concept-badge" className="font-bold">
        {concept}
      </span>
    </span>
  );
}

const LEVEL_STYLE: Record<KnowledgeLevel, string> = {
  FUNDAMENTAL: "bg-level-fundamental text-level-fundamental-foreground",
  PROFESSIONAL: "bg-level-profissional text-level-profissional-foreground",
  ADVANCED: "bg-level-avancado text-level-avancado-foreground",
};

/** Round letter mark for a level (decorative). */
export function LevelMark({ level, locked = false }: { level: KnowledgeLevel; locked?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
        locked ? "bg-muted text-muted-foreground" : LEVEL_STYLE[level],
      )}
    >
      {locked ? "🔒" : LEVEL_LABELS[level][0]}
    </span>
  );
}

export function LevelBadge({ level }: { level: KnowledgeLevel }) {
  return (
    <span className={cn(pill, LEVEL_STYLE[level])}>
      <span className="sr-only">Nível: </span>
      {LEVEL_LABELS[level]}
    </span>
  );
}
