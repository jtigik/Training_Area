"use client";

import { useParams } from "next/navigation";
import { LevelFeedbackView } from "@/components/aluno/level-feedback-view";
import { EmptyState } from "@/components/common/page-states";
import { levelFromSlug } from "@/lib/api";

export default function StudentLevelFeedbackPage() {
  const { nivel } = useParams<{ nivel: string }>();
  const level = levelFromSlug(nivel);
  if (!level) return <EmptyState title="Nível não encontrado" />;
  return <LevelFeedbackView level={level} />;
}
