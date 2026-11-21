"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState, LoadingState, StatusMessage } from "@/components/common/states";
import { SetStatusBadge } from "@/components/common/badges";
import { useResource } from "@/hooks/use-resource";
import type { ExerciseContent } from "@/lib/domain/types";
import { getServices } from "@/lib/services";
import { ExerciseForm, type ExerciseFormSubmit } from "./exercise-form";
import { ExercisePreview, PREVIEW_STORAGE_KEY } from "./exercise-preview";

const toExerciseInput = (values: ExerciseFormSubmit) => {
  const { tags, ...rest } = values;
  void tags; // tags só existem no banco
  return rest;
};

export function NewExercisePage({ setId }: { setId: string }) {
  const router = useRouter();
  const set = useResource(() => getServices().sets.get(setId), `set:${setId}`);
  if (set.error) return <ErrorState error={set.error} onRetry={set.reload} />;
  if (!set.data) return <LoadingState />;
  return (
    <>
      <PageHeader
        title="Novo exercício"
        description={
          <>
            Conjunto{" "}
            <Link href={`/professor/conjuntos/${setId}`} className="underline">
              {set.data.name}
            </Link>
          </>
        }
      />
      <ExerciseForm
        allowedLevels={set.data.levels}
        onSubmit={async (values) => {
          const created = await getServices().exercises.create(setId, toExerciseInput(values));
          router.replace(`/professor/exercicios/${created.id}`);
        }}
      />
    </>
  );
}

export function EditExercisePage({ id }: { id: string }) {
  const exercise = useResource(() => getServices().exercises.get(id), `exercise:${id}`);
  const set = useResource(
    () => (exercise.data ? getServices().sets.get(exercise.data.setId) : Promise.resolve(null)),
    `exercise-set:${exercise.data?.setId ?? ""}`,
  );
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const error = exercise.error ?? set.error;
  if (error) return <ErrorState error={error} onRetry={exercise.reload} />;
  if (!exercise.data || !set.data) return <LoadingState />;
  const ex = exercise.data;
  return (
    <>
      <PageHeader
        title="Editar exercício"
        description={
          <>
            Conjunto{" "}
            <Link href={`/professor/conjuntos/${set.data.id}`} className="underline">
              {set.data.name}
            </Link>
          </>
        }
        actions={<SetStatusBadge status={ex.status} />}
      />
      <StatusMessage message={message} />
      <ExerciseForm
        key={ex.updatedAt}
        initial={ex}
        allowedLevels={set.data.levels}
        onSubmit={async (values) => {
          const saved = await getServices().exercises.update(id, toExerciseInput(values));
          exercise.setData(saved);
          setMessage({ kind: "ok", text: "Exercício salvo." });
        }}
      />
    </>
  );
}

/** Página aberta em nova aba pelo botão "Pré-visualizar como aluno". */
export function PreviewPage() {
  const [exercise, setExercise] = useState<ExerciseContent | null | undefined>(undefined);
  useEffect(() => {
    const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do localStorage no cliente
    setExercise(raw ? (JSON.parse(raw) as ExerciseContent) : null);
  }, []);
  if (exercise === undefined) return <LoadingState />;
  if (exercise === null)
    return <p>Nada para pré-visualizar. Abra a partir do editor de exercícios.</p>;
  return <ExercisePreview exercise={exercise} />;
}
