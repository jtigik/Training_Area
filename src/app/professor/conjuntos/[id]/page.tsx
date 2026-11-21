import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/common/states";
import { EditSetPage } from "@/components/professor/sets/set-pages";

export const metadata: Metadata = { title: "Conjunto · Training Area" };

async function Content({ params }: { params: PageProps<"/professor/conjuntos/[id]">["params"] }) {
  const { id } = await params;
  return <EditSetPage id={id} />;
}

export default function Page({ params }: PageProps<"/professor/conjuntos/[id]">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Content params={params} />
    </Suspense>
  );
}
