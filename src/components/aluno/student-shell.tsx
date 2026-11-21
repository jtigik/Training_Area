"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { api, ApiError, ROLE_HOME } from "@/lib/api";
import { ErrorState, LoadingState, Skeleton } from "@/components/common/page-states";
import { useApiResource } from "@/components/common/use-api-resource";
import { SessionProvider } from "./session-context";
import { StudentHeader } from "./student-header";

function SkipLink() {
  return (
    <a
      href="#conteudo"
      className="sr-only rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
    >
      Pular para o conteúdo
    </a>
  );
}

export function ForbiddenView({ home }: { home?: string }) {
  return (
    <main id="conteudo" className="mx-auto max-w-xl px-4 py-16 text-center">
      <p className="font-formula text-4xl font-bold text-muted-foreground">403</p>
      <h1 className="mt-2 text-2xl font-semibold">Acesso negado</h1>
      <p className="mt-2 text-muted-foreground">
        Esta área é exclusiva para alunos. Se você acha que isso é um erro, fale com a sua
        instituição.
      </p>
      {home && (
        <Link href={home} className="mt-6 inline-block text-primary underline">
          Ir para a minha área
        </Link>
      )}
    </main>
  );
}

/**
 * Client-side guard + layout for /aluno/*. Backend 1's proxy (src/proxy.ts on
 * feat/auth-modelo) does the route-level RBAC; this checks the session/role with
 * the API (401 -> /login?callbackUrl=, other roles -> 403 view) and renders the
 * header with the user's institution.
 */
export function StudentShell({ children }: { children: ReactNode }) {
  const me = useApiResource("me", () => api.me());

  if (me.error && !(me.error instanceof ApiError && me.error.status === 401)) {
    return (
      <main id="conteudo" className="mx-auto max-w-6xl px-4 py-8">
        <ErrorState
          title="Não foi possível carregar sua sessão"
          error={me.error}
          onRetry={me.reload}
        />
      </main>
    );
  }
  if (!me.data) {
    return (
      <>
        <div className="border-b bg-card px-4 py-3">
          <Skeleton className="mx-auto h-8 max-w-6xl" />
        </div>
        <main id="conteudo" className="mx-auto max-w-6xl px-4 py-8">
          <LoadingState label="Carregando…" />
        </main>
      </>
    );
  }
  if (me.data.role !== "ALUNO") {
    return <ForbiddenView home={ROLE_HOME[me.data.role]} />;
  }
  return (
    <SessionProvider user={me.data}>
      <SkipLink />
      <StudentHeader user={me.data} />
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-6 outline-none sm:py-8"
      >
        {children}
      </main>
    </SessionProvider>
  );
}
