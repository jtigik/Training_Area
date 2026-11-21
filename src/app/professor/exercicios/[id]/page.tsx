import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/common/states";
import { EditExercisePage } from "@/components/professor/exercises/exercise-pages";

export const metadata: Metadata = { title: "Exercício · Training Area" };

async function Content({ params }: { params: PageProps<"/professor/exercicios/[id]">["params"] }) {
  const { id } = await params;
  return <EditExercisePage id={id} />;
}

export default function Page({ params }: PageProps<"/professor/exercicios/[id]">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Content params={params} />
    </Suspense>
  );
}
