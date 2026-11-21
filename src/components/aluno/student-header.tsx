"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, type SessionUser } from "@/lib/api";
import { cn } from "@/lib/utils";
import { initials } from "./format";

const NAV = [
  {
    href: "/aluno",
    label: "Minha trilha",
    match: (p: string) =>
      p === "/aluno" || p.startsWith("/aluno/exercicios") || p.startsWith("/aluno/niveis"),
  },
  {
    href: "/aluno/conteudo",
    label: "Conteúdo",
    match: (p: string) => p.startsWith("/aluno/conteudo"),
  },
];

export function StudentHeader({ user }: { user: SessionUser }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    try {
      await api.logout();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/aluno" className="flex items-center gap-2 font-semibold">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-md bg-primary font-formula text-sm text-primary-foreground"
          >
            fx
          </span>
          Training Area
        </Link>
        <p
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
          data-testid="institution-name"
        >
          <Building2 aria-hidden="true" className="size-4" />
          <span className="sr-only">Instituição: </span>
          {user.institution.name}
        </p>
        <nav aria-label="Principal" className="order-last w-full sm:order-none sm:w-auto">
          <ul className="flex gap-1">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex rounded-md px-3 py-2 text-sm font-medium hover:bg-muted",
                      active && "bg-accent text-accent-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-right text-sm leading-tight md:block">
            <span className="block font-medium">{user.name}</span>
            <span className="block text-muted-foreground">Aluno</span>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-lg"
                className="rounded-full font-semibold"
                aria-label={`Menu da conta de ${user.name}`}
              >
                {initials(user.name)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel>
                <span className="block">{user.name}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {user.institution.name}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={leaving} onSelect={() => void logout()}>
                <LogOut aria-hidden="true" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
