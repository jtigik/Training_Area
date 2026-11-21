"use client";

import { LoginPanel } from "@/components/auth/login-panel";
import { api } from "@/lib/api";

export function LoginScreen() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <section
        aria-hidden="true"
        className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex"
      >
        <p className="text-lg font-semibold">Training Area</p>
        <div className="space-y-3">
          <p className="w-fit rounded-md bg-primary-foreground/10 px-3 py-2 font-formula text-2xl">
            =SOMA(B2:B4)
          </p>
          <p className="max-w-sm text-2xl font-semibold">
            Pratique Excel de verdade, do Fundamental ao Avançado.
          </p>
        </div>
        <p className="text-sm opacity-80">Plataforma de treinamento em Excel</p>
      </section>
      <main id="conteudo" className="flex items-center justify-center p-6">
        <LoginPanel
          startLogin={api.startLogin}
          loginOptions={api.getLoginOptions}
          currentUser={api.me}
        />
      </main>
    </div>
  );
}
