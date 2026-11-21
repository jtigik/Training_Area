"use client";

import { notFound, useParams } from "next/navigation";
import { LevelFeedbackView } from "@/components/aluno/level-feedback-view";
import { levelFromSlug } from "@/lib/api";

export function FeedbackPage() {
  const { nivel } = useParams<{ nivel: string }>();
  const level = levelFromSlug(nivel);
  // Unknown or non-MVP levels (e.g. "dashboard", v1.1) do not exist in the UI.
  if (!level) notFound();
  return <LevelFeedbackView level={level} />;
}
