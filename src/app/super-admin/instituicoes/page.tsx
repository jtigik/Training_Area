import type { Metadata } from "next";
import { InstitutionsManager } from "@/components/super-admin/institutions-manager";

export const metadata: Metadata = { title: "Instituições · Training Area" };

export default function Page() {
  return <InstitutionsManager />;
}
