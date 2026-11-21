"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ConceptBadge, LevelBadge, ProgressBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState, LoadingState, StatusMessage } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useResource } from "@/hooks/use-resource";
import { LEVEL_LABELS } from "@/lib/domain/labels";
import { canRedoLevel, formatDateTimeBR } from "@/lib/domain/rules";
import type { LevelProgress } from "@/lib/domain/types";
import { errorMessage } from "@/lib/errors";
import { getServices } from "@/lib/services";

/** /professor/resultados/alunos/[id] — tentativas, conceitos por nível e refazer nível (ND/ED). */
export function StudentDetailPage({ id }: { id: string }) {
  const params = useSearchParams();
  const detail = useResource(() => getServices().results.student(id), `student:${id}`);
  const sets = useResource(() => getServices().sets.list(), "sets");
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const back = `/professor/resultados${params.toString() ? `?${params.toString()}` : ""}`;

  if (detail.error) return <ErrorState error={detail.error} onRetry={detail.reload} />;
  if (!detail.data) return <LoadingState />;
  const { student, progress, attempts } = detail.data;
  const setName = (setId: string) => sets.data?.find((s) => s.id === setId)?.name ?? setId;
  const sorted = [...attempts].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  async function redo(p: LevelProgress) {
    setBusy(true);
    try {
      await getServices().results.redoLevel(student.id, p.setId, p.level);
      setMessage({
        kind: "ok",
        text: `${LEVEL_LABELS[p.level]} reaberto: ${student.name} pode refazer o nível.`,
      });
      detail.reload();
    } catch (e) {
      setMessage({ kind: "erro", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={student.name}
        description={student.email}
        actions={
          <Button asChild variant="outline">
            <Link href={back}>Voltar aos resultados</Link>
          </Button>
        }
      />
      <StatusMessage message={message} />
      <section aria-labelledby="levels-title" className="mb-8">
        <h2 id="levels-title" className="mb-3 text-lg font-semibold">
          Níveis
        </h2>
        {progress.length === 0 ? (
          <EmptyState title="Ainda não iniciou nenhum nível." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {progress.map((p) => {
              const eligible = canRedoLevel(p);
              return (
                <article
                  key={`${p.setId}-${p.level}`}
                  className="bg-card grid gap-3 rounded-lg border p-4"
                  aria-label={`${LEVEL_LABELS[p.level]} — ${setName(p.setId)}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelBadge level={p.level} />
                    <ProgressBadge status={p.status} />
                    {p.concept ? <ConceptBadge concept={p.concept} /> : null}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {setName(p.setId)} · {p.levelAttempt}ª tentativa do nível · {p.correct}/
                    {p.required} acertos
                  </p>
                  <p className="text-sm">
                    {eligible
                      ? "Pode refazer o nível (conceito ND ou ED)."
                      : p.status === "COMPLETED"
                        ? "Concluído com D ou PD: refazer não se aplica."
                        : "Refazer fica disponível ao concluir com ND ou ED."}
                  </p>
                  {eligible ? (
                    <Button
                      data-testid="redo-button"
                      size="sm"
                      disabled={busy}
                      onClick={() => redo(p)}
                    >
                      Liberar refazer {LEVEL_LABELS[p.level]}
                    </Button>
                  ) : null}
                  {p.history.length ? (
                    <table
                      className="text-sm"
                      aria-label={`Histórico do nível ${LEVEL_LABELS[p.level]}`}
                    >
                      <thead>
                        <tr className="text-muted-foreground text-left text-xs">
                          <th className="font-medium">Vez</th>
                          <th className="font-medium">Acertos</th>
                          <th className="font-medium">Conceito</th>
                          <th className="font-medium">Concluída em</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.history.map((h) => (
                          <tr key={h.levelAttempt}>
                            <td>{h.levelAttempt}ª</td>
                            <td className="tabular-nums">
                              {h.correct}/{h.done}
                            </td>
                            <td>{h.concept ? <ConceptBadge concept={h.concept} /> : "—"}</td>
                            <td>
                              {h.completedAt ? formatDateTimeBR(h.completedAt) : "em andamento"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
      <section aria-labelledby="attempts-title">
        <h2 id="attempts-title" className="mb-3 text-lg font-semibold">
          Tentativas enviadas
        </h2>
        {sorted.length === 0 ? (
          <EmptyState title="Nenhuma tentativa enviada." />
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Tentativas">
              <TableHeader>
                <TableRow>
                  <TableHead>Exercício</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Data e hora</TableHead>
                  <TableHead>Resposta</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="text-right">Nº</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.exerciseTitle}</TableCell>
                    <TableCell>
                      {LEVEL_LABELS[a.level]}
                      {a.levelAttempt > 1 ? (
                        <span className="text-muted-foreground text-xs">
                          {" "}
                          ({a.levelAttempt}ª vez)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTimeBR(a.submittedAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {Object.entries(a.submitted)
                        .map(([cell, v]) => `${cell}: ${v}`)
                        .join("; ")}
                    </TableCell>
                    <TableCell>
                      <span className={a.correct ? "text-success" : "text-destructive"}>
                        {a.correct ? "Correto" : "Incorreto"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{a.attemptNumber}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </>
  );
}
