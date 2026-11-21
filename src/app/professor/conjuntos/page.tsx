import type { Metadata } from "next";
import { SetsListPage } from "@/components/professor/sets/set-pages";

export const metadata: Metadata = { title: "Conjuntos · Training Area" };

export default function Page() {
  return <SetsListPage />;
}
