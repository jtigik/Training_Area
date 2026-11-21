"use client";

import { useState } from "react";
import { ConceptBadge, LevelBadge, ReviewStatusBadge } from "@/components/common/badges";
import { NativeSelect } from "@/components/common/native-select";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState, LoadingState, StatusMessage } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useResource } from "@/hooks/use-resource";
import { REVIEW_STATUS_LABELS } from "@/lib/domain/labels";
import { formatDateTimeBR } from "@/lib/domain/rules";
import { REVIEW_STATUSES, type ReviewFeedback, type ReviewStatus } from "@/lib/domain/types";
import { errorMessage } from "@/lib/errors";
import { getServices } from "@/lib/services";

/** Um item da fila: lê, edita, aprova ou rejeita (motivo opcional). */
export function ReviewItem({
  item,
  onDone,
}: {
  item: ReviewFeedback;
  onDone: (updated: ReviewFeedback, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.finalText);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = item.status === "DRAFT";
  const open = item.status !== "APPROVED";
  const textId = `review-text-${item.id}`;

  async function run(action: () => Promise<ReviewFeedback>, ok: string) {
    setBusy(true);
    setError(null);
    try {
      onDone(await action(), ok);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li data-testid="review-feedback-item" className="bg-card grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{item.studentName}</span>
        <LevelBadge level={item.level} />
        <ConceptBadge concept={item.concept} />
        <span className="text-muted-foreground text-sm">
          {item.accuracyPercent}% · {item.setName} · tentativa {item.levelAttempt} ·{" "}
          {formatDateTimeBR(item.createdAt)}
        </span>
        <span className="flex-1" />
        <ReviewStatusBadge status={item.status} />
      </div>
      {editing ? (
        <div className="grid gap-1.5">
          <Label htmlFor={textId}>Feedback para {item.studentName}</Label>
          <Textarea id={textId} rows={5} value={text} onChange={(e) => setText(e.target.value)} />
          <details className="text-muted-foreground text-xs">
            <summary className="cursor-pointer">Texto original da IA</summary>
            <p className="mt-1 whitespace-pre-wrap">{item.generatedText}</p>
          </details>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{item.finalText}</p>
      )}
      {item.status === "REJECTED" && item.rejectionReason ? (
        <p className="text-muted-foreground text-xs">Motivo: {item.rejectionReason}</p>
      ) : null}
      {rejecting ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`reason-${item.id}`}>Motivo da rejeição (opcional)</Label>
          <Input
            id={`reason-${item.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {open ? (
        <div className="flex flex-wrap gap-2">
          {!editing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="feedback-edit"
              onClick={() => setEditing(true)}
            >
              Editar
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="feedback-edit"
              disabled={busy || !text.trim()}
              onClick={() =>
                run(() => getServices().reviews.saveDraft(item.id, text), "Edição guardada.")
              }
            >
              Guardar edição
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            data-testid="feedback-approve"
            disabled={busy || !text.trim()}
            onClick={() =>
              run(
                () => getServices().reviews.approve(item.id, text),
                `Feedback de ${item.studentName} aprovado e liberado.`,
              )
            }
          >
            Aprovar
          </Button>
          {pending ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              data-testid="feedback-reject"
              disabled={busy}
              onClick={() =>
                run(
                  () => getServices().reviews.reject(item.id, reason || undefined),
                  `Feedback de ${item.studentName} rejeitado: edite ou gere de novo. O aluno não vê o texto rejeitado.`,
                )
              }
            >
              Rejeitar
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                run(
                  () => getServices().reviews.regenerate(item.id),
                  `Novo texto gerado para ${item.studentName}.`,
                )
              }
            >
              Gerar novamente
            </Button>
          )}
          {pending && !rejecting ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting(true)}>
              Informar motivo
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

type Filter = "OPEN" | ReviewStatus;
const FILTERS: Record<Filter, { label: string; statuses: ReviewStatus[] }> = {
  OPEN: { label: "A revisar (pendentes e rejeitados)", statuses: ["DRAFT", "REJECTED"] },
  ...(Object.fromEntries(
    REVIEW_STATUSES.map((s) => [s, { label: REVIEW_STATUS_LABELS[s], statuses: [s] }]),
  ) as Record<ReviewStatus, { label: string; statuses: ReviewStatus[] }>),
};

/** /professor/revisao-feedback — fila de revisão do feedback gerado por IA. */
export function ReviewQueuePage() {
  const [filter, setFilter] = useState<Filter>("OPEN");
  const statuses = FILTERS[filter].statuses;
  const reviews = useResource(
    () => getServices().reviews.list({ status: statuses }),
    `reviews:${filter}`,
  );
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);

  return (
    <>
      <PageHeader
        title="Revisão de feedback"
        description="O feedback gerado por IA só chega ao aluno depois que você aprova. Edite o texto se precisar."
      />
      <div className="mb-4 max-w-xs">
        <Field label="Situação">
          <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            {(Object.keys(FILTERS) as Filter[]).map((f) => (
              <option key={f} value={f}>
                {FILTERS[f].label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <StatusMessage message={message} />
      {reviews.error ? (
        <ErrorState error={reviews.error} onRetry={reviews.reload} />
      ) : !reviews.data ? (
        <LoadingState />
      ) : reviews.data.length === 0 ? (
        <EmptyState
          title={filter === "OPEN" ? "Nenhum feedback aguardando revisão." : "Nada por aqui."}
        />
      ) : (
        <ul className="grid gap-3" aria-label="Feedbacks">
          {reviews.data.map((r) => (
            <ReviewItem
              key={r.id}
              item={r}
              onDone={(updated, text) => {
                setMessage({ kind: "ok", text });
                const list = reviews.data ?? [];
                reviews.setData(
                  statuses.includes(updated.status)
                    ? list.map((x) => (x.id === updated.id ? updated : x))
                    : list.filter((x) => x.id !== updated.id),
                );
              }}
            />
          ))}
        </ul>
      )}
    </>
  );
}
