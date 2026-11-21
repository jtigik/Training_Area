import { AppShell } from "@/components/layout/app-shell";

export default function Layout({ children }: LayoutProps<"/professor">) {
  return <AppShell variant="professor">{children}</AppShell>;
}
