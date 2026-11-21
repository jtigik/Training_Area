"use client";

import { useParams } from "next/navigation";
import { ExerciseView } from "@/components/aluno/exercise-view";

export default function StudentExercisePage() {
  const { slug } = useParams<{ slug: string }>();
  return <ExerciseView exerciseId={decodeURIComponent(slug)} />;
}
