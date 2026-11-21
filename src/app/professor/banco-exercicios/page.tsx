import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/common/states";
import { BankPage } from "@/components/professor/bank/bank-pages";

export const metadata: Metadata = { title: "Banco de exercícios · Training Area" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <BankPage />
    </Suspense>
  );
}
