import { AppShell } from "@/components/layout/app-shell";

export default function Layout({ children }: LayoutProps<"/superadmin">) {
  return <AppShell variant="superadmin">{children}</AppShell>;
}
