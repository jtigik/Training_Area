"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTH_PROVIDER_LABELS, type AuthProvider, type StudentApi } from "@/lib/api";

const DEFAULT_PROVIDERS = (Object.keys(AUTH_PROVIDER_LABELS) as AuthProvider[]).map((id) => ({
  id,
  label: AUTH_PROVIDER_LABELS[id],
}));
import { callbackTarget, postLoginPath } from "@/lib/auth/redirect";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
    </svg>
  );
}

const ICONS: Record<AuthProvider, () => React.ReactElement> = {
  google: GoogleIcon,
  microsoft: MicrosoftIcon,
};

/**
 * Login with Google or Microsoft only (no e-mail/password, no sign-up page).
 * Buttons come from GET /api/login-options (Backend 1); the dev/test e-mail+password
 * option is never shown. Handles ?callbackUrl= (legacy ?voltar=) with a safe redirect,
 * ?motivo=sessao-expirada and ?erro=/?error= (OAuth callback error).
 */
export function LoginPanel({
  startLogin,
  loginOptions,
  currentUser,
}: {
  startLogin: StudentApi["startLogin"];
  /** Enabled providers; when missing or failing, Google and Microsoft are offered. */
  loginOptions?: StudentApi["getLoginOptions"];
  /** Optional: if a session already exists (e.g. back from the OAuth provider), forward the user. */
  currentUser?: StudentApi["me"];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const voltar = callbackTarget(params);
  const [providers, setProviders] = useState<{ id: AuthProvider; label: string }[] | null>(
    loginOptions ? null : DEFAULT_PROVIDERS,
  );
  const expired = params.get("motivo") === "sessao-expirada";
  const [pending, setPending] = useState<AuthProvider | null>(null);
  const [failed, setFailed] = useState(params.has("erro") || params.has("error"));
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (failed) alertRef.current?.focus();
  }, [failed]);

  useEffect(() => {
    if (!loginOptions) return;
    let cancelled = false;
    loginOptions().then(
      (opts) => {
        if (cancelled) return;
        const known = opts.providers.filter((p) => p.id in AUTH_PROVIDER_LABELS);
        setProviders(known);
      },
      () => {
        if (!cancelled) setProviders(DEFAULT_PROVIDERS);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loginOptions]);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    currentUser().then(
      (user) => {
        if (!cancelled) router.replace(postLoginPath(user.role, voltar));
      },
      () => {
        /* not signed in: stay on the login page */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [currentUser, router, voltar]);

  async function login(provider: AuthProvider) {
    setPending(provider);
    setFailed(false);
    try {
      // Better Auth returns to callbackURL; /login then forwards to ?callbackUrl= or the role's home.
      const callbackURL = `/login${voltar ? `?callbackUrl=${encodeURIComponent(voltar)}` : ""}`;
      const res = await startLogin(provider, callbackURL);
      if (res.kind === "redirect") {
        window.location.assign(res.url);
        return;
      }
      router.replace(postLoginPath(res.user.role, voltar));
    } catch {
      setPending(null);
      setFailed(true);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Entrar no Training Area</h1>
        <p className="text-muted-foreground">Use a conta Google ou Microsoft da sua instituição.</p>
      </div>

      {expired && !failed && (
        <div
          role="status"
          className="rounded-md border border-info/40 bg-info-subtle p-3 text-sm text-info-subtle-foreground"
        >
          <span aria-hidden="true">ⓘ </span>
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </div>
      )}
      {failed && (
        <div
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className="rounded-md border border-error/40 bg-error-subtle p-3 text-sm text-error-subtle-foreground outline-none"
        >
          <span aria-hidden="true">⚠ </span>
          <strong>Não foi possível entrar.</strong> Tente de novo ou use a conta indicada pela sua
          instituição.
        </div>
      )}

      <div className="space-y-3" aria-busy={pending !== null || providers === null}>
        {providers === null ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Carregando opções de
            acesso…
          </p>
        ) : providers.length === 0 ? (
          <p role="alert" className="text-sm">
            Nenhuma forma de acesso está habilitada. Fale com a sua instituição.
          </p>
        ) : (
          providers.map(({ id: provider, label }) => {
            const Icon = ICONS[provider];
            const busy = pending === provider;
            return (
              <Button
                key={provider}
                type="button"
                variant="outline"
                className="h-11 w-full justify-center gap-3 text-base"
                disabled={pending !== null}
                aria-busy={busy}
                onClick={() => void login(provider)}
              >
                {busy ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Icon />}
                {busy ? "Entrando…" : `Entrar com ${label}`}
              </Button>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Ao entrar, você acessa a área correspondente ao seu perfil. Problemas com o acesso? Fale com
        a sua instituição.
      </p>
    </div>
  );
}
