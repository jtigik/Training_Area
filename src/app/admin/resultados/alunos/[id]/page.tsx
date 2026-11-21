import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/common/states";
import { StudentDetailPage } from "@/components/professor/results/student-detail";

export const metadata: Metadata = { title: "Aluno · Training Area" };

async function Content({
  params,
}: {
  params: PageProps<"/admin/resultados/alunos/[id]">["params"];
}) {
  const { id } = await params;
  return <StudentDetailPage id={id} readOnly basePath="/admin/resultados" />;
}

/** Admin da instituição: detalhe do aluno só leitura (sem refazer nível). */
export default function Page({ params }: PageProps<"/admin/resultados/alunos/[id]">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Content params={params} />
    </Suspense>
  );
}
