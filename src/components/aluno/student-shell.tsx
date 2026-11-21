"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, ROLE_HOME } from "@/lib/api";
import { ErrorState, LoadingState, Skeleton } from "@/components/common/page-states";
import { useApiResource } from "@/components/common/use-api-resource";
import { markSignedIn } from "@/lib/auth/session-marker";
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

/**
 * Client-side guard + layout for /aluno/*. Backend 1's proxy (src/proxy.ts on
 * feat/auth-modelo) does the route-level RBAC; this checks the session/role with
 * the API (401 -> /login?callbackUrl=; another role -> defensive client redirect to
 * its own area home, since the proxy already does that) and renders the header
 * with the user's institution.
 */
export function StudentShell({ children }: { children: ReactNode }) {
  const me = useApiResource("me", () => api.me());
  const router = useRouter();
  const otherRoleHome = me.data && me.data.role !== "ALUNO" ? ROLE_HOME[me.data.role] : null;

  const signedIn = Boolean(me.data);

  useEffect(() => {
    if (signedIn) markSignedIn();
  }, [signedIn]);

  useEffect(() => {
    if (otherRoleHome) router.replace(otherRoleHome);
  }, [otherRoleHome, router]);

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
  if (!me.data || otherRoleHome) {
    return (
      <>
        <div className="border-b bg-card px-4 py-3">
          <Skeleton className="mx-auto h-8 max-w-6xl" />
        </div>
        <main id="conteudo" className="mx-auto max-w-6xl px-4 py-8">
          <LoadingState label={otherRoleHome ? "Redirecionando…" : "Carregando…"} />
        </main>
      </>
    );
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
