import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/common/states";
import { EditBankItemPage } from "@/components/professor/bank/bank-pages";

export const metadata: Metadata = { title: "Exercício do banco · Training Area" };

async function Content({
  params,
}: {
  params: PageProps<"/professor/banco-exercicios/[id]">["params"];
}) {
  const { id } = await params;
  return <EditBankItemPage id={id} />;
}

export default function Page({ params }: PageProps<"/professor/banco-exercicios/[id]">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Content params={params} />
    </Suspense>
  );
}
