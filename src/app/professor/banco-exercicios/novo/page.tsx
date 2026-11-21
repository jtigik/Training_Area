import type { Metadata } from "next";
import { NewBankItemPage } from "@/components/professor/bank/bank-pages";

export const metadata: Metadata = { title: "Novo exercício do banco · Training Area" };

export default function Page() {
  return <NewBankItemPage />;
}
