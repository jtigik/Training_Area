import { Suspense } from "react";
import { ContentList } from "@/components/aluno/content-list";
import { LoadingState } from "@/components/common/page-states";

export default function StudentContentPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando o conteúdo…" />}>
      <ContentList />
    </Suspense>
  );
}
