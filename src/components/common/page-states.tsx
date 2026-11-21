import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Loading placeholder announced politely to screen readers. */
export function LoadingState({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>
      {children ?? (
        <>
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </>
      )}
    </div>
  );
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status !== 500) return error.message;
  return fallback;
}

export function ErrorState({
  title,
  error,
  onRetry,
}: {
  title: string;
  error?: unknown;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-error/40 bg-error-subtle p-4 text-error-subtle-foreground sm:flex-row sm:items-center"
    >
      <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        {error !== undefined && (
          <p className="text-sm">{errorMessage(error, "Verifique sua conexão e tente de novo.")}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <Inbox aria-hidden="true" className="size-8 text-muted-foreground" />
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="max-w-prose text-muted-foreground">{children}</div>}
      {action}
    </div>
  );
}
