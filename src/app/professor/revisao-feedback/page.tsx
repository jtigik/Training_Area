import type { Metadata } from "next";
import { ReviewQueuePage } from "@/components/professor/review/review-queue";

export const metadata: Metadata = { title: "Revisão de feedback · Training Area" };

export default function Page() {
  return <ReviewQueuePage />;
}
