"use client";

import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { LevelBadge, SectionStatusBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState, LoadingState, StatusMessage } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import type { ContentSection } from "@/lib/domain/types";
import { errorMessage } from "@/lib/errors";
import { getServices } from "@/lib/services";

/** Move o item `index` uma posição para cima (-1) ou para baixo (+1). */
export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function SectionsList() {
  const router = useRouter();
  const sections = useResource(() => getServices().sections.list(), "sections");
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function move(list: ContentSection[], index: number, delta: -1 | 1) {
    const next = moveItem(list, index, delta);
    sections.setData(next.map((s, position) => ({ ...s, position })));
    setBusy(true);
    try {
      await getServices().sections.reorder(next.map((s) => s.id));
      setMessage({
        kind: "ok",
        text: `“${list[index].title}” foi para a posição ${index + delta + 1}.`,
      });
    } catch (e) {
      setMessage({ kind: "erro", text: errorMessage(e) });
      sections.reload();
    } finally {
      setBusy(false);
    }
  }

  const open = (id: string) => router.push(`/professor/conteudo/${id}`);
  const onRowClick = (e: MouseEvent, id: string) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    open(id);
  };

  return (
    <>
      <PageHeader
        title="Seções de conteúdo"
        description="Crie o material de estudo, defina a ordem de navegação e publique para os alunos."
        actions={
          <Button onClick={() => router.push("/professor/conteudo/nova")}>Nova seção</Button>
        }
      />
      <StatusMessage message={message} />
      {sections.error ? (
        <ErrorState error={sections.error} onRetry={sections.reload} />
      ) : !sections.data ? (
        <LoadingState />
      ) : sections.data.length === 0 ? (
        <EmptyState title="Nenhuma seção ainda.">
          Crie a primeira seção para os alunos estudarem antes dos exercícios.
        </EmptyState>
      ) : (
        <ol className="grid gap-2" aria-label="Seções na ordem de navegação">
          {sections.data.map((s, i, list) => (
            <li
              key={s.id}
              data-testid="section-item"
              onClick={(e) => onRowClick(e, s.id)}
              className="bg-card hover:bg-muted/40 flex cursor-pointer flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
            >
              <span className="text-muted-foreground w-6 text-sm tabular-nums" aria-hidden="true">
                {i + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={`/professor/conteudo/${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    open(s.id);
                  }}
                  className="font-medium hover:underline focus-visible:underline"
                >
                  {s.title}
                </a>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {s.level ? <LevelBadge level={s.level} /> : null}
                  <SectionStatusBadge status={s.status} />
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={busy || i === 0}
                  onClick={() => move(list, i, -1)}
                  aria-label={`Mover para cima — ${s.title}`}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={busy || i === list.length - 1}
                  onClick={() => move(list, i, 1)}
                  aria-label={`Mover para baixo — ${s.title}`}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
