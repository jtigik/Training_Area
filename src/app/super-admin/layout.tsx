import { AppShell } from "@/components/layout/app-shell";

export default function Layout({ children }: LayoutProps<"/super-admin">) {
  return <AppShell variant="super-admin">{children}</AppShell>;
}
