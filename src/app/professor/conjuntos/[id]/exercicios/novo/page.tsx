import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/common/states";
import { NewExercisePage } from "@/components/professor/exercises/exercise-pages";

export const metadata: Metadata = { title: "Novo exercício · Training Area" };

async function Content({
  params,
}: {
  params: PageProps<"/professor/conjuntos/[id]/exercicios/novo">["params"];
}) {
  const { id } = await params;
  return <NewExercisePage setId={id} />;
}

export default function Page({ params }: PageProps<"/professor/conjuntos/[id]/exercicios/novo">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Content params={params} />
    </Suspense>
  );
}
