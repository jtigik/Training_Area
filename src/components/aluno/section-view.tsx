"use client";

import Link from "next/link";
import { Markdown } from "@/components/common/markdown";
import { ErrorState, LoadingState } from "@/components/common/page-states";
import { useApiResource } from "@/components/common/use-api-resource";
import { api, LEVEL_LABELS } from "@/lib/api";
import { Breadcrumbs } from "./breadcrumbs";

export function SectionView({ sectionId }: { sectionId: string }) {
  const section = useApiResource(`section:${sectionId}`, () => api.getSection(sectionId));
  if (section.error) {
    return (
      <ErrorState
        title="Não foi possível abrir esta seção"
        error={section.error}
        onRetry={section.reload}
      />
    );
  }
  if (!section.data) return <LoadingState label="Carregando a seção…" />;
  const s = section.data;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Breadcrumbs items={[{ href: "/aluno/conteudo", label: "Conteúdo" }, { label: s.title }]} />
      <article aria-labelledby="titulo-secao" className="rounded-xl border bg-card p-5 sm:p-8">
        <p className="text-sm text-muted-foreground">
          {s.level ? `Nível ${LEVEL_LABELS[s.level]}` : "Conteúdo geral"}
          {s.readMinutes ? ` · ${s.readMinutes} min de leitura` : ""}
        </p>
        <h1 id="titulo-secao" className="mb-4 text-3xl font-semibold tracking-tight">
          {s.title}
        </h1>
        <Markdown>{s.body}</Markdown>
      </article>
      <Link
        href="/aluno/conteudo"
        className="inline-block text-primary underline-offset-4 hover:underline"
      >
        ← Voltar ao conteúdo
      </Link>
    </div>
  );
}
