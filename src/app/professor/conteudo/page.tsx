import type { Metadata } from "next";
import { SectionsList } from "@/components/professor/sections/sections-list";

export const metadata: Metadata = { title: "Conteúdo · Training Area" };

export default function Page() {
  return <SectionsList />;
}
