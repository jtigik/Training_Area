import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProgressBar } from "@/components/common/progress-bar";
import {
  canRetake,
  LEVEL_LABELS,
  LEVEL_SLUGS,
  type ExerciseSummary,
  type KnowledgeLevel,
  type TrailLevel,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ConceptBadge,
  DifficultyBadge,
  ExerciseStatusBadge,
  LevelMark,
  LevelStatusBadge,
} from "./badges";
import { formatDate, formatPercent } from "./format";
import { RetakeLevelButton } from "./retake-level-button";

export const exerciseHref = (id: string) => `/aluno/exercicios/${encodeURIComponent(id)}`;
export const feedbackHref = (level: KnowledgeLevel) =>
  `/aluno/niveis/${LEVEL_SLUGS[level]}/feedback`;
export const levelAnchor = (level: KnowledgeLevel) => `nivel-${LEVEL_SLUGS[level]}`;

function exerciseAction(e: ExerciseSummary): string {
  if (e.status === "CORRECT") return "Revisar";
  if (e.status === "INCORRECT") return "Tentar de novo";
  return "Começar";
}

/** First exercise the student should do next (not yet correct), if any. */
export function nextExercise(level: TrailLevel): ExerciseSummary | undefined {
  return (
    level.exercises.find((e) => e.status === "NOT_STARTED") ??
    level.exercises.find((e) => e.status === "INCORRECT")
  );
}

export function LevelCard({
  level,
  index,
  total,
  previousLevel,
  onChanged,
}: {
  level: TrailLevel;
  index: number;
  total: number;
  previousLevel?: KnowledgeLevel;
  onChanged: () => void;
}) {
  const name = LEVEL_LABELS[level.level];
  const headingId = levelAnchor(level.level);
  const locked = level.status === "LOCKED";
  const counted = level.bestConcept ?? level.concept;
  const { done, required, correct } = level.progress;
  const next = nextExercise(level);

  return (
    <li className="flex gap-3 sm:gap-4">
      <LevelMark level={level.level} locked={locked} />
      <article
        aria-labelledby={headingId}
        className={cn(
          "flex-1 rounded-xl border bg-card p-4 shadow-xs sm:p-5",
          locked && "bg-muted/40",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Nível {index + 1} de {total}
            </p>
            <h2 id={headingId} className="scroll-mt-20 text-xl font-semibold">
              {name}
            </h2>
            <div className="flex flex-wrap gap-2">
              <LevelStatusBadge status={level.status} />
              {/* The BEST concept across runs is the one that counts. */}
              {counted && <ConceptBadge concept={counted} />}
              {level.run > 1 && (
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
                  Tentativa {level.run}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {level.status === "COMPLETED" && (
              <>
                <Link
                  href={feedbackHref(level.level)}
                  className={buttonVariants({ variant: "default" })}
                >
                  Ver feedback
                  <span className="sr-only"> do nível {name}</span>
                </Link>
                {counted && canRetake(counted) && (
                  <RetakeLevelButton level={level.level} concept={counted} onDone={onChanged} />
                )}
              </>
            )}
            {(level.status === "IN_PROGRESS" || level.status === "NOT_STARTED") && next && (
              <Link href={exerciseHref(next.id)} className={buttonVariants({ variant: "default" })}>
                {level.status === "IN_PROGRESS" ? "Continuar" : "Começar"}
                <span className="sr-only"> nível {name}</span>
              </Link>
            )}
          </div>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">{level.description}</p>

        {locked ? (
          <p className="mt-3 text-sm">
            {previousLevel ? (
              <>
                Alcance o conceito <strong>D</strong> ou <strong>PD</strong> no nível{" "}
                <strong>{LEVEL_LABELS[previousLevel]}</strong> para liberar.
              </>
            ) : (
              "Este nível ainda não foi liberado."
            )}{" "}
            {required} exercícios.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {level.status === "COMPLETED" && level.completedAt && (
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Feitos</dt>
                  <dd className="font-semibold">
                    {done} de {required}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Acertos</dt>
                  <dd className="font-semibold">{formatPercent(correct, required)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Concluído em</dt>
                  <dd className="font-semibold">{formatDate(level.completedAt)}</dd>
                </div>
              </dl>
            )}
            <div className="space-y-1">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  {done} de {required} feitos · {Math.max(0, required - done)} restantes
                </span>
                <span>Acertos: {formatPercent(correct, done)}</span>
              </div>
              <ProgressBar label={`Progresso do nível ${name}`} value={done} max={required} />
            </div>

            {level.exercises.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption className="sr-only">
                    Exercícios liberados no nível {name}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col" className="w-8">
                        #
                      </TableHead>
                      <TableHead scope="col">Exercício</TableHead>
                      <TableHead scope="col">Dificuldade</TableHead>
                      <TableHead scope="col">Status</TableHead>
                      <TableHead scope="col" className="hidden sm:table-cell">
                        Tentativas
                      </TableHead>
                      <TableHead scope="col">
                        <span className="sr-only">Ação</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {level.exercises.map((e, i) => (
                      <TableRow key={e.id} data-testid="exercise-item">
                        <TableCell>{i + 1}</TableCell>
                        <th scope="row" className="px-2 text-left font-medium">
                          {e.title}
                        </th>
                        <TableCell>
                          <DifficultyBadge difficulty={e.difficulty} />
                        </TableCell>
                        <TableCell>
                          <ExerciseStatusBadge status={e.status} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{e.attempts}</TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={exerciseHref(e.id)}
                            className="font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {exerciseAction(e)}
                            <span className="sr-only">
                              {" "}
                              exercício {i + 1}: {e.title}
                            </span>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {level.sections.length > 0 && (
              <div className="text-sm">
                <h3 className="font-medium">Conteúdo do nível</h3>
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {level.sections.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/aluno/conteudo/${encodeURIComponent(s.id)}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {s.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </article>
    </li>
  );
}
