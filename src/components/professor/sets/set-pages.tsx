"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DifficultyBadge, LevelBadge, SetStatusBadge } from "@/components/common/badges";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useResource } from "@/hooks/use-resource";
import { formatDateTimeBR, getPublishIssues } from "@/lib/domain/rules";
import { LEVEL_LABELS } from "@/lib/domain/labels";
import type { ExerciseSet } from "@/lib/domain/types";
import { errorMessage } from "@/lib/errors";
import { getServices } from "@/lib/services";
import { SetForm } from "./set-form";

export function SetsListPage() {
  const sets = useResource(() => getServices().sets.list(), "sets");
  return (
    <>
      <PageHeader
        title="Conjuntos de exercícios"
        description="Cada conjunto define níveis, dificuldades e quantos exercícios cada aluno recebe."
        actions={
          <Button asChild>
            <Link href="/professor/conjuntos/novo">Novo conjunto</Link>
          </Button>
        }
      />
      {sets.error ? (
        <ErrorState error={sets.error} onRetry={sets.reload} />
      ) : !sets.data ? (
        <LoadingState />
      ) : sets.data.length === 0 ? (
        <EmptyState title="Nenhum conjunto ainda.">
          Crie um conjunto e adicione exercícios (pelo editor, do banco ou por .xlsx).
        </EmptyState>
      ) : (
        <Table aria-label="Conjuntos">
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Níveis</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sets.data.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link
                    href={`/professor/conjuntos/${s.id}`}
                    className="font-medium hover:underline"
                  >
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {s.levels.map((l) => (
                      <LevelBadge key={l} level={l} />
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <SetStatusBadge status={s.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

function usePeople() {
  const students = useResource(() => getServices().people.students(), "students");
  const classrooms = useResource(() => getServices().people.classrooms(), "classrooms");
  return {
    students: students.data,
    classrooms: classrooms.data,
    error: students.error ?? classrooms.error,
  };
}

export function NewSetPage() {
  const router = useRouter();
  const people = usePeople();
  return (
    <>
      <PageHeader
        title="Novo conjunto"
        description="Depois de salvar, adicione exercícios e publique."
      />
      {people.error ? (
        <ErrorState error={people.error} />
      ) : !people.students || !people.classrooms ? (
        <LoadingState />
      ) : (
        <SetForm
          students={people.students}
          classrooms={people.classrooms}
          onSubmit={async (input) => {
            const created = await getServices().sets.create(input);
            router.replace(`/professor/conjuntos/${created.id}`);
          }}
        />
      )}
    </>
  );
}

export function EditSetPage({ id }: { id: string }) {
  const set = useResource(() => getServices().sets.get(id), `set:${id}`);
  const exercises = useResource(() => getServices().exercises.listBySet(id), `set-exercises:${id}`);
  const published = useResource(
    () => getServices().exercises.listPublished(id),
    `set-published:${id}`,
  );
  const people = usePeople();
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const error = set.error ?? exercises.error ?? people.error;
  if (error) return <ErrorState error={error} onRetry={() => (set.reload(), exercises.reload())} />;
  if (!set.data || !exercises.data || !people.students || !people.classrooms)
    return <LoadingState />;

  const current: ExerciseSet = set.data;
  const issues = getPublishIssues(current, exercises.data);

  async function togglePublish() {
    setBusy(true);
    try {
      const next =
        current.status === "PUBLISHED"
          ? await getServices().sets.unpublish(id)
          : await getServices().sets.publish(id);
      set.setData(next);
      published.reload();
      setMessage({
        kind: "ok",
        text:
          next.status === "PUBLISHED"
            ? "Conjunto liberado para os alunos."
            : "Conjunto retirado dos alunos; o progresso foi mantido.",
      });
    } catch (e) {
      setMessage({ kind: "erro", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={current.name}
        description={current.levels.map((l) => LEVEL_LABELS[l]).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SetStatusBadge status={current.status} />
            {current.status === "PUBLISHED" ? (
              <Button variant="outline" disabled={busy} onClick={togglePublish}>
                Despublicar conjunto
              </Button>
            ) : (
              <Button
                disabled={busy || issues.length > 0}
                onClick={togglePublish}
                aria-describedby={issues.length ? "publish-issues" : undefined}
              >
                Publicar conjunto
              </Button>
            )}
          </div>
        }
      />
      <StatusMessage message={message} />
      {current.publishedAt && published.data ? (
        <p className="text-muted-foreground mb-4 text-sm" data-testid="published-version">
          Versão publicada em {formatDateTimeBR(current.publishedAt)}: {published.data.length}{" "}
          {published.data.length === 1 ? "exercício" : "exercícios"}. Os alunos recebem essa cópia;
          mudanças no rascunho só valem depois de publicar de novo.
        </p>
      ) : null}
      {current.status !== "PUBLISHED" && issues.length > 0 ? (
        <div
          id="publish-issues"
          className="border-warning bg-warning-subtle mb-4 rounded-md border p-3 text-sm"
        >
          <p className="font-medium">Para liberar aos alunos:</p>
          <ul className="list-disc pl-5">
            {issues.map((i) => (
              <li key={`${i.level}-${i.difficulty}`}>{i.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="exercicios">Exercícios ({exercises.data.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="pt-4">
          <SetForm
            key={current.updatedAt}
            set={current}
            students={people.students}
            classrooms={people.classrooms}
            onSubmit={async (input) => {
              set.setData(await getServices().sets.update(id, input));
              setMessage({ kind: "ok", text: "Conjunto salvo." });
            }}
          />
        </TabsContent>
        <TabsContent value="exercicios" className="pt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/professor/conjuntos/${id}/exercicios/novo`}>Novo exercício</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/professor/banco-exercicios?conjunto=${id}`}>Adicionar do banco</Link>
            </Button>
          </div>
          {exercises.data.length === 0 ? (
            <EmptyState title="Sem exercícios neste conjunto.">
              Crie no editor ou copie do banco de exercícios.
            </EmptyState>
          ) : (
            <ul className="grid gap-2" aria-label="Exercícios do conjunto">
              {exercises.data.map((e) => (
                <li
                  key={e.id}
                  data-testid="exercise-item"
                  className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3"
                >
                  <Link
                    href={`/professor/exercicios/${e.id}`}
                    className="flex-1 font-medium hover:underline"
                  >
                    {e.title}
                  </Link>
                  <LevelBadge level={e.level} />
                  <DifficultyBadge difficulty={e.difficulty} />
                  <SetStatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
