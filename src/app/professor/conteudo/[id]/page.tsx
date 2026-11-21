import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/common/states";
import { EditSectionPage } from "@/components/professor/sections/section-form";

export const metadata: Metadata = { title: "Editar seção · Training Area" };

async function Content({ params }: { params: PageProps<"/professor/conteudo/[id]">["params"] }) {
  const { id } = await params;
  return <EditSectionPage id={id} />;
}

export default function Page({ params }: PageProps<"/professor/conteudo/[id]">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Content params={params} />
    </Suspense>
  );
}
