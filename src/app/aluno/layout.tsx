import type { Metadata } from "next";
import { Suspense } from "react";
import { StudentShell } from "@/components/aluno/student-shell";
import { LoadingState } from "@/components/common/page-states";

export const metadata: Metadata = { title: "Área do aluno · Training Area" };

export default function StudentLayout({ children }: LayoutProps<"/aluno">) {
  // The student area is client-rendered (session + data come from the API), so
  // runtime hooks (pathname, params, search params) stream in behind Suspense.
  return (
    <Suspense
      fallback={
        <main id="conteudo" className="mx-auto max-w-6xl px-4 py-8">
          <LoadingState label="Carregando…" />
        </main>
      }
    >
      <StudentShell>{children}</StudentShell>
    </Suspense>
  );
}
