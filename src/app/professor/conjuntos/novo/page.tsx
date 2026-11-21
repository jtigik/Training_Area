import type { Metadata } from "next";
import { NewSetPage } from "@/components/professor/sets/set-pages";

export const metadata: Metadata = { title: "Novo conjunto · Training Area" };

export default function Page() {
  return <NewSetPage />;
}
