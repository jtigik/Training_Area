"use client";

import { ErrorState, LoadingState, Skeleton } from "@/components/common/page-states";
import { useApiResource } from "@/components/common/use-api-resource";
import { api } from "@/lib/api";
import { ExerciseWorkspace } from "./exercise-workspace";

export function ExerciseView({ exerciseId }: { exerciseId: string }) {
  const exercise = useApiResource(`exercise:${exerciseId}`, () => api.getExercise(exerciseId));
  if (exercise.error) {
    return (
      <ErrorState
        title="Não foi possível abrir o exercício"
        error={exercise.error}
        onRetry={exercise.reload}
      />
    );
  }
  if (!exercise.data) {
    return (
      <LoadingState label="Carregando o exercício…">
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      </LoadingState>
    );
  }
  // key: reset local state when navigating to another exercise.
  return (
    <ExerciseWorkspace key={exercise.data.id} exercise={exercise.data} submit={api.submitAttempt} />
  );
}
