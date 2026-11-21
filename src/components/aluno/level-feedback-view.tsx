"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Hourglass, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorState, LoadingState } from "@/components/common/page-states";
import { useApiResource } from "@/components/common/use-api-resource";
import { api, canRetake, LEVEL_LABELS, type KnowledgeLevel, type LevelFeedback } from "@/lib/api";
import { ConceptBadge, DifficultyBadge, LevelBadge, ResultBadge } from "./badges";
import { Breadcrumbs } from "./breadcrumbs";
import { formatDateTime } from "./format";
import { levelAnchor } from "./level-card";
import { RetakeLevelButton } from "./retake-level-button";
import { useVisibilityPolling } from "@/components/common/use-visibility-polling";

/** How often the "em revisão" screen checks whether the teacher approved the feedback. */
export const FEEDBACK_POLL_MS = 30_000;
import { useRouter } from "next/navigation";

export function LevelFeedbackView({ level }: { level: KnowledgeLevel }) {
  const feedback = useApiResource(`feedback:${level}`, () => api.getLevelFeedback(level));
  const router = useRouter();
  // "Em revisão": check again every 30 s while the tab is visible (PO), plus the manual button.
  useVisibilityPolling(feedback.reload, FEEDBACK_POLL_MS, feedback.data?.status === "IN_REVIEW");
  if (feedback.error && !feedback.data) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: `Feedback do nível ${LEVEL_LABELS[level]}` }]} />
        <ErrorState
          title="Não conseguimos carregar o feedback agora"
          error={feedback.error}
          onRetry={feedback.reload}
        />
      </div>
    );
  }
  if (!feedback.data) return <LoadingState label="Preparando seu feedback…" />;
  return (
    <LevelFeedbackContent
      feedback={feedback.data}
      onRefresh={feedback.reload}
      refreshing={feedback.loading}
      onRetaken={() => router.push(`/aluno#${levelAnchor(level)}`)}
    />
  );
}

export function LevelFeedbackContent({
  feedback,
  onRefresh,
  refreshing = false,
  onRetaken,
}: {
  feedback: LevelFeedback;
  onRefresh: () => void;
  refreshing?: boolean;
  onRetaken: () => void;
}) {
  const name = LEVEL_LABELS[feedback.level];
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  const { correct, total, percent } = feedback.score;
  const message = feedback.message;
  const avg = total === 0 ? 0 : feedback.attempts / total;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: `Feedback do nível ${name}` }]} />

      <section aria-labelledby="titulo" className="space-y-4">
        <div className="space-y-2">
          <LevelBadge level={feedback.level} />
          <h1
            id="titulo"
            ref={titleRef}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight outline-none"
          >
            Nível {name} concluído! <span aria-hidden="true">🎉</span>
          </h1>
          <p className="text-muted-foreground">
            Concluído em {formatDateTime(feedback.completedAt)} · {total} de {total} exercícios
          </p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-3">
            <dt className="text-sm text-muted-foreground">Conceito</dt>
            <dd className="mt-1">
              <ConceptBadge concept={feedback.concept} />
            </dd>
            {feedback.run > 1 && (
              <dd className="mt-1 text-xs text-muted-foreground">
                Tentativa {feedback.run} · melhor conceito: <strong>{feedback.bestConcept}</strong>
              </dd>
            )}
          </div>
          <div className="rounded-lg border bg-card p-3">
            <dt className="text-sm text-muted-foreground">Taxa de acerto</dt>
            <dd className="text-2xl font-semibold">{percent}%</dd>
            <dd className="text-sm text-muted-foreground">
              {correct} de {total} corretos
            </dd>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <dt className="text-sm text-muted-foreground">Tentativas</dt>
            <dd className="text-2xl font-semibold">{feedback.attempts}</dd>
            <dd className="text-sm text-muted-foreground">
              média de {avg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por exercício
            </dd>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <dt className="text-sm text-muted-foreground">Dificuldades praticadas</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {feedback.difficultiesPracticed.map((d) => (
                <DifficultyBadge key={d} difficulty={d} />
              ))}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {feedback.status === "IN_REVIEW" || !message ? (
          // Pending teacher approval: the AI text is never shown, and this region is
          // deliberately not named "Seu feedback" (QA: ai-feedback-review.spec.ts).
          <section
            aria-labelledby="msg-revisao"
            data-testid="feedback-pending"
            className="space-y-3 rounded-xl border border-info/40 bg-info-subtle p-5 text-info-subtle-foreground"
          >
            <h2 id="msg-revisao" className="flex items-center gap-2 text-xl font-semibold">
              <Hourglass aria-hidden="true" className="size-5" /> Feedback em revisão
            </h2>
            <p role="status">
              Seu feedback personalizado foi gerado e está aguardando o professor revisar. Ele
              aparece aqui assim que for aprovado. Enquanto isso, seu resultado já está registrado:{" "}
              {percent}% de acerto, conceito {feedback.concept}.
            </p>
            <Button
              variant="outline"
              onClick={onRefresh}
              disabled={refreshing}
              aria-busy={refreshing}
            >
              <RefreshCw aria-hidden="true" />
              Verificar novamente
            </Button>
          </section>
        ) : (
          <section aria-labelledby="msg" className="space-y-4 rounded-xl border bg-card p-5">
            <h2 id="msg" className="text-xl font-semibold">
              Seu feedback
            </h2>
            <p className="text-sm text-muted-foreground">
              {percent}% de acerto · conceito {feedback.concept}
            </p>
            <div className="space-y-3 leading-relaxed">
              {message.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-success-subtle p-3 text-success-subtle-foreground">
                <h3 className="font-semibold">
                  <span aria-hidden="true">✓ </span>Pontos fortes
                </h3>
                {message.strengths.length ? (
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {message.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm">
                    Continue praticando para destacar seus pontos fortes.
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-warning-subtle p-3 text-warning-subtle-foreground">
                <h3 className="font-semibold">
                  <span aria-hidden="true">↻ </span>O que revisar
                </h3>
                {message.toReview.length ? (
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {message.toReview.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm">Nada pendente neste nível.</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Feedback gerado com IA a partir do seu desempenho e revisado pelo seu professor. Ele
              fica salvo e não muda depois.
            </p>
          </section>
        )}

        <aside aria-label="Próximos passos" className="space-y-3">
          {canRetake(feedback.bestConcept) && (
            <div className="space-y-2 rounded-xl border border-warning/40 bg-warning-subtle p-4 text-warning-subtle-foreground">
              <p className="font-semibold">Quer melhorar seu conceito?</p>
              <p className="text-sm">
                Com conceito {feedback.bestConcept} o próximo nível continua bloqueado. Refaça este
                nível quantas vezes quiser: vale o melhor conceito.
              </p>
              <RetakeLevelButton
                level={feedback.level}
                concept={feedback.bestConcept}
                onDone={onRetaken}
                variant="default"
              />
            </div>
          )}
          {feedback.nextLevel && !feedback.nextLevel.unlocked ? (
            <div
              data-testid="next-level-locked"
              className="space-y-1 rounded-xl border bg-muted/40 p-4 text-sm"
            >
              <p className="font-medium">
                <span aria-hidden="true">🔒 </span>
                {LEVEL_LABELS[feedback.nextLevel.level]} bloqueado
              </p>
              <p className="text-muted-foreground">
                Alcance o conceito D ou PD neste nível para liberar o próximo.
              </p>
            </div>
          ) : feedback.nextLevel ? (
            <div className="space-y-2 rounded-xl border bg-accent p-4 text-accent-foreground">
              <p className="text-sm font-medium">
                <span aria-hidden="true">🔓 </span>Nível liberado
              </p>
              <p className="text-xl font-semibold">{LEVEL_LABELS[feedback.nextLevel.level]}</p>
              <p className="text-sm">
                {feedback.nextLevel.exerciseCount} exercícios · {feedback.nextLevel.summary}
              </p>
              <Link
                href={`/aluno#${levelAnchor(feedback.nextLevel.level)}`}
                className={buttonVariants({ className: "w-full" })}
              >
                Começar nível {LEVEL_LABELS[feedback.nextLevel.level]}
              </Link>
            </div>
          ) : (
            <Link href="/aluno" className={buttonVariants({ className: "w-full" })}>
              Ver resumo da trilha
            </Link>
          )}
          {feedback.recommendedSection && (
            <Link
              href={`/aluno/conteudo/${encodeURIComponent(feedback.recommendedSection.id)}`}
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              Revisar conteúdo recomendado
            </Link>
          )}
          <Link href="/aluno" className={buttonVariants({ variant: "ghost", className: "w-full" })}>
            Voltar à trilha
          </Link>
        </aside>
      </div>

      <section aria-labelledby="resumo" className="space-y-2">
        <h2 id="resumo" className="text-xl font-semibold">
          Resumo dos exercícios
        </h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableCaption className="sr-only">
              Exercícios do nível {name} com a última resposta enviada
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">#</TableHead>
                <TableHead scope="col">Exercício</TableHead>
                <TableHead scope="col">Dificuldade</TableHead>
                <TableHead scope="col">Última resposta</TableHead>
                <TableHead scope="col">Tentativas</TableHead>
                <TableHead scope="col">Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedback.items.map((item, i) => (
                <TableRow key={item.exerciseId}>
                  <TableCell>{i + 1}</TableCell>
                  <th scope="row" className="px-2 text-left font-medium">
                    {item.title}
                  </th>
                  <TableCell>
                    <DifficultyBadge difficulty={item.difficulty} />
                  </TableCell>
                  <TableCell className="font-formula">{item.lastSubmission ?? "—"}</TableCell>
                  <TableCell>{item.attempts}</TableCell>
                  <TableCell>
                    <ResultBadge correct={item.correct} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
