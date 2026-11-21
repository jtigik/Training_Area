"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getServices, isMockMode, resetMockData } from "@/lib/services";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  /** Ativo só na rota exata (ex.: página inicial da área). */
  exact?: boolean;
}

export function isActive(pathname: string, item: NavItem) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Evento disparado quando o admin salva as configurações (atualiza o nome no cabeçalho). */
export const SETTINGS_UPDATED_EVENT = "training-area:settings-updated";

interface AppShellProps {
  /** Área da casca; define título, menu e se mostra o nome da instituição. */
  variant: ShellVariant;
  children: ReactNode;
}

async function signOut() {
  try {
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
  } finally {
    // Recarga completa de propósito: descarta estado de cliente da sessão encerrada.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
}

/** Casca das áreas do professor, do admin da instituição e do super admin. */
/** Links do menu; o item ativo depende da URL (lida dentro de Suspense). */
function NavLinks({ nav, pathname }: { nav: NavItem[]; pathname: string }) {
  return (
    <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col md:py-4">
      {nav.map((item) => {
        const active = isActive(pathname, item);
        return (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveNavLinks({ nav }: { nav: NavItem[] }) {
  return <NavLinks nav={nav} pathname={usePathname() ?? ""} />;
}

export type ShellVariant = "professor" | "admin" | "superadmin";

const VARIANTS: Record<
  ShellVariant,
  { area: string; tenantHeader: boolean; nav: () => NavItem[] }
> = {
  professor: { area: "Área do professor", tenantHeader: true, nav: () => PROFESSOR_NAV },
  admin: { area: "Admin da instituição", tenantHeader: true, nav: () => ADMIN_NAV },
  superadmin: { area: "Super Admin", tenantHeader: false, nav: () => SUPERADMIN_NAV },
};

export function AppShell({ variant, children }: AppShellProps) {
  const { area, tenantHeader } = VARIANTS[variant];
  const nav = VARIANTS[variant].nav();
  const [instanceName, setInstanceName] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantHeader) return;
    let active = true;
    const load = () =>
      getServices()
        .settings.get()
        .then((s) => active && setInstanceName(s.instanceName))
        .catch(() => undefined);
    load();
    window.addEventListener(SETTINGS_UPDATED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(SETTINGS_UPDATED_EVENT, load);
    };
  }, [tenantHeader]);

  return (
    <div className="bg-background min-h-dvh">
      <a
        href="#conteudo"
        className="bg-primary text-primary-foreground sr-only z-50 rounded px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3 md:px-6">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {tenantHeader ? (instanceName ?? "Training Area") : "Training Area — Plataforma"}
          </p>
          <p className="text-muted-foreground text-xs">{area}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Menu da conta">
              Conta
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{area}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isMockMode() ? (
              <DropdownMenuItem
                onSelect={() => {
                  resetMockData();
                  window.location.reload();
                }}
              >
                Restaurar dados de exemplo
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => void signOut()}>Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="md:grid md:grid-cols-[15rem_1fr]">
        <nav
          aria-label="Principal"
          className="bg-muted/40 border-b md:min-h-[calc(100dvh-4rem)] md:border-r md:border-b-0"
        >
          <Suspense fallback={<NavLinks nav={nav} pathname="" />}>
            <ActiveNavLinks nav={nav} />
          </Suspense>
        </nav>
        <main id="conteudo" className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export const PROFESSOR_NAV: NavItem[] = [
  { href: "/professor", label: "Visão geral", exact: true },
  { href: "/professor/conteudo", label: "Conteúdo" },
  { href: "/professor/conjuntos", label: "Conjuntos" },
  { href: "/professor/banco-exercicios", label: "Banco de exercícios" },
  { href: "/professor/feedback", label: "Modelos de feedback" },
  { href: "/professor/revisao-feedback", label: "Revisão de feedback" },
  { href: "/professor/resultados", label: "Resultados" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Visão geral", exact: true },
  { href: "/admin/usuarios", label: "Usuários e papéis" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export const SUPERADMIN_NAV: NavItem[] = [
  { href: "/superadmin/instituicoes", label: "Instituições" },
];
