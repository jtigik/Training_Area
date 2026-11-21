"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock, Lock } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/page-states";
import { useApiResource } from "@/components/common/use-api-resource";
import {
  api,
  LEVEL_LABELS,
  LEVEL_SLUGS,
  levelFromSlug,
  type KnowledgeLevel,
  type SectionSummary,
  type Trail,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface Group {
  key: string;
  title: string;
  level: KnowledgeLevel | null;
  locked: boolean;
  sections: SectionSummary[];
}

function groupsOf(trail: Trail): Group[] {
  const groups: Group[] = [];
  if (trail.generalSections.length > 0) {
    groups.push({
      key: "geral",
      title: "Geral",
      level: null,
      locked: false,
      sections: trail.generalSections,
    });
  }
  for (const l of trail.levels) {
    if (l.sections.length === 0) continue;
    groups.push({
      key: l.level,
      title: LEVEL_LABELS[l.level],
      level: l.level,
      locked: l.status === "LOCKED",
      sections: l.sections,
    });
  }
  for (const g of groups) g.sections = [...g.sections].sort((a, b) => a.order - b.order);
  return groups;
}

export function ContentList() {
  const params = useSearchParams();
  const filter = levelFromSlug(params.get("nivel") ?? "");
  const trail = useApiResource("trail", () => api.getTrail());

  if (trail.error) {
    return (
      <ErrorState
        title="Não foi possível carregar o conteúdo"
        error={trail.error}
        onRetry={trail.reload}
      />
    );
  }
  if (!trail.data) return <LoadingState label="Carregando o conteúdo…" />;

  const all = groupsOf(trail.data);
  // Transversal sections (no level) always appear (TA-012 AC2).
  const groups = filter ? all.filter((g) => g.level === filter || g.level === null) : all;
  const levels = trail.data.levels.map((l) => l.level);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Conteúdo</h1>
        <p className="text-muted-foreground">
          Estude as seções antes de praticar os exercícios de cada nível.
        </p>
      </div>

      {all.length > 0 && (
        <nav aria-label="Filtrar por nível">
          <ul className="flex flex-wrap gap-2">
            {[
              { slug: null, label: "Todos" },
              ...levels.map((l) => ({ slug: LEVEL_SLUGS[l], label: LEVEL_LABELS[l] })),
            ].map((item) => {
              const active = (filter ? LEVEL_SLUGS[filter] : null) === item.slug;
              return (
                <li key={item.label}>
                  <Link
                    href={item.slug ? `/aluno/conteudo?nivel=${item.slug}` : "/aluno/conteudo"}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex rounded-full border px-3 py-1 text-sm hover:bg-muted",
                      active && "border-primary bg-accent text-accent-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {groups.length === 0 ? (
        <EmptyState title="Ainda não há conteúdo publicado">
          Aguarde o seu professor publicar as primeiras seções. Elas aparecerão aqui.
        </EmptyState>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-labelledby={`grupo-${g.key}`} className="space-y-2">
            <h2 id={`grupo-${g.key}`} className="flex items-center gap-2 text-xl font-semibold">
              {g.title}
              {g.locked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  <Lock aria-hidden="true" className="size-3" /> Bloqueado
                </span>
              )}
            </h2>
            <ul className="divide-y rounded-lg border bg-card">
              {g.sections.map((s) => (
                <li
                  key={s.id}
                  data-testid="content-section-item"
                  className="flex items-center justify-between gap-3 p-3"
                >
                  {g.locked ? (
                    <span className="text-muted-foreground">{s.title}</span>
                  ) : (
                    <Link
                      href={`/aluno/conteudo/${encodeURIComponent(s.id)}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {s.title}
                    </Link>
                  )}
                  {s.readMinutes && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Clock aria-hidden="true" className="size-3" />
                      {s.readMinutes} min de leitura
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
