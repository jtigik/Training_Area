import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/common/states";
import { StudentDetailPage } from "@/components/professor/results/student-detail";

export const metadata: Metadata = { title: "Aluno · Training Area" };

async function Content({
  params,
}: {
  params: PageProps<"/professor/resultados/alunos/[id]">["params"];
}) {
  const { id } = await params;
  return <StudentDetailPage id={id} />;
}

export default function Page({ params }: PageProps<"/professor/resultados/alunos/[id]">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Content params={params} />
    </Suspense>
  );
}
