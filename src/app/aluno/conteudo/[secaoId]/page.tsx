"use client";

import { useParams } from "next/navigation";
import { SectionView } from "@/components/aluno/section-view";

export default function StudentSectionPage() {
  const { secaoId } = useParams<{ secaoId: string }>();
  return <SectionView sectionId={decodeURIComponent(secaoId)} />;
}
