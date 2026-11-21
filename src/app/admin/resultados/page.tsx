import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/common/states";
import { ResultsPage } from "@/components/professor/results/results-page";

export const metadata: Metadata = { title: "Resultados · Training Area" };

/** Admin da instituição: resultados em modo só leitura. */
export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ResultsPage basePath="/admin/resultados" />
    </Suspense>
  );
}
