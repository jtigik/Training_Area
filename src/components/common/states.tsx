import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="text-muted-foreground flex items-center gap-2 py-8 text-sm"
    >
      <span
        className="border-primary size-4 animate-spin rounded-full border-2 border-t-transparent"
        aria-hidden="true"
      />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/5 rounded-md border p-4 text-sm"
    >
      <p className="text-destructive font-medium">Não foi possível carregar.</p>
      <p className="text-muted-foreground mt-1">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      {children ? <div className="text-muted-foreground mt-2 text-sm">{children}</div> : null}
    </div>
  );
}

/** Mensagem de sucesso/erro anunciada a leitores de tela. */
export function StatusMessage({
  message,
}: {
  message: { kind: "ok" | "erro"; text: string } | null;
}) {
  return (
    <div aria-live="polite" role="status" className="min-h-5 text-sm">
      {message ? (
        <span className={message.kind === "ok" ? "text-success" : "text-destructive"}>
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
