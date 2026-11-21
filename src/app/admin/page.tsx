import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Admin da instituição · Training Area" };

const LINKS = [
  {
    href: "/admin/usuarios",
    title: "Usuários e papéis",
    text: "Professores, alunos e admins da instituição.",
  },
  {
    href: "/admin/configuracoes",
    title: "Configurações",
    text: "Nome da instância e cadastro aberto.",
  },
];

export default function Page() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Admin da instituição</h1>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block h-full rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              <Card className="hover:bg-muted/40 h-full transition-colors">
                <CardHeader>
                  <CardTitle>{l.title}</CardTitle>
                  <CardDescription>{l.text}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
