import type { Metadata } from "next";
import { SettingsPage } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Configurações · Training Area" };

export default function Page() {
  return <SettingsPage />;
}
