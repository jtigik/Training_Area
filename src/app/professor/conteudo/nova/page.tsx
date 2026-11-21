import type { Metadata } from "next";
import { SectionForm } from "@/components/professor/sections/section-form";

export const metadata: Metadata = { title: "Nova seção · Training Area" };

export default function Page() {
  return <SectionForm />;
}
