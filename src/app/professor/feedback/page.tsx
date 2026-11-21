import type { Metadata } from "next";
import { FeedbackPage } from "@/components/professor/feedback/feedback-editor";

export const metadata: Metadata = { title: "Faixas de feedback · Training Area" };

export default function Page() {
  return <FeedbackPage />;
}
