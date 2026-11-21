"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, Skeleton } from "@/components/common/page-states";
import { ProgressBar } from "@/components/common/progress-bar";
import { useApiResource } from "@/components/common/use-api-resource";
import { api, LEVEL_ORDER, type Trail } from "@/lib/api";
import { LevelCard } from "./level-card";
import { useSessionUser } from "./session-context";

export function TrailView() {
  const trail = useApiResource("trail", () => api.getTrail());
  if (trail.error) {
    return (
      <ErrorState
        title="Não foi possível carregar sua trilha"
        error={trail.error}
        onRetry={trail.reload}
      />
    );
  }
  if (!trail.data) {
    return (
      <LoadingState label="Carregando sua trilha…">
        <Skeleton className="h-10 w-2/3" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </LoadingState>
    );
  }
  return <TrailContent trail={trail.data} onChanged={trail.reload} />;
}

export function TrailContent({ trail, onChanged }: { trail: Trail; onChanged: () => void }) {
  const user = useSessionUser();
  const firstName = user.name.split(" ")[0];

  if (!trail.set || trail.levels.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Olá, {firstName}!</h1>
        <EmptyState
          title="Nenhum exercício publicado ainda"
          action={
            <Link href="/aluno/conteudo" className={buttonVariants({ variant: "outline" })}>
              Ir para o conteúdo
            </Link>
          }
        >
          Seu professor ainda não liberou a trilha. Enquanto isso, você pode estudar o conteúdo.
        </EmptyState>
      </div>
    );
  }

  const done = trail.levels.reduce((n, l) => n + l.progress.done, 0);
  const required = trail.levels.reduce((n, l) => n + l.progress.required, 0);
  const totalLevels = trail.levels.length;
  const ordered = [...trail.levels].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Conjunto: {trail.set.name}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Olá, {firstName}! Continue sua trilha
          </h1>
        </div>
        <div className="w-full space-y-1 md:w-72">
          <div className="flex justify-between text-sm">
            <span>Progresso geral</span>
            <span>
              {done} de {required} exercícios
            </span>
          </div>
          <ProgressBar label="Progresso geral da trilha" value={done} max={required} />
        </div>
      </div>
      <ol aria-label="Níveis da trilha" className="space-y-4">
        {ordered.map((level, i) => (
          <LevelCard
            key={level.level}
            level={level}
            index={i}
            total={totalLevels}
            previousLevel={ordered[i - 1]?.level}
            onChanged={onChanged}
          />
        ))}
      </ol>
    </div>
  );
}
