import type { Metadata } from "next";
import { PreviewPage } from "@/components/professor/exercises/exercise-pages";

export const metadata: Metadata = { title: "Pré-visualização · Training Area" };

export default function Page() {
  return <PreviewPage />;
}
