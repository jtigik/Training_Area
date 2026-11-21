import type { Metadata } from "next";
import { ForbiddenView } from "@/components/aluno/student-shell";

export const metadata: Metadata = { title: "Acesso negado · Training Area" };

/** Access-denied page (a role opening another role's area). Route-level RBAC is Backend 1's src/proxy.ts. */
export default function AccessDeniedPage() {
  return <ForbiddenView home="/" />;
}
