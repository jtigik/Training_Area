import type { Metadata } from "next";
import { ForbiddenView } from "@/components/aluno/student-shell";

export const metadata: Metadata = { title: "Acesso negado · Training Area" };

/** Rendered (with HTTP 403) by src/proxy.ts when a role opens another role's area. */
export default function AccessDeniedPage() {
  return <ForbiddenView home="/" />;
}
