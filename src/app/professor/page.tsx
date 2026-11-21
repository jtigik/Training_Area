import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Área do professor · Training Area" };

const LINKS = [
  {
    href: "/professor/conteudo",
    title: "Conteúdo",
    text: "Seções de estudo e ordem de navegação.",
  },
  {
    href: "/professor/conjuntos",
    title: "Conjuntos",
    text: "Níveis, dificuldades e quantidade por aluno ou turma.",
  },
  {
    href: "/professor/banco-exercicios",
    title: "Banco de exercícios",
    text: "Banco inicial, itens da instituição e importação .xlsx.",
  },
  {
    href: "/professor/feedback",
    title: "Faixas de feedback",
    text: "Textos automáticos por faixa de acerto.",
  },
  {
    href: "/professor/revisao-feedback",
    title: "Revisão de feedback",
    text: "Aprove ou rejeite o feedback gerado por IA.",
  },
  {
    href: "/professor/resultados",
    title: "Resultados",
    text: "Conceitos ND, ED, D e PD e tentativas de cada aluno.",
  },
];

export default function Page() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Área do professor</h1>
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
