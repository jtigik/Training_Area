import { notFound } from "next/navigation";
import { levelFromSlug, LEVEL_SLUGS } from "@/lib/api/types";
import { FeedbackPage } from "./feedback-page";

export function generateStaticParams() {
  return Object.values(LEVEL_SLUGS).map((nivel) => ({ nivel }));
}

/** Only MVP levels exist: any other slug (e.g. "dashboard", v1.1) is not found. */
export default async function StudentLevelFeedbackPage({
  params,
}: PageProps<"/aluno/niveis/[nivel]/feedback">) {
  const { nivel } = await params;
  if (!levelFromSlug(nivel)) notFound();
  return <FeedbackPage />;
}
