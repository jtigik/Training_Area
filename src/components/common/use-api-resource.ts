"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { isUnauthenticated } from "@/lib/api";

/** Redirect to the login page with the "session expired" notice (TA-001 AC4). */
export function useSessionExpiredRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(() => {
    const callbackUrl = encodeURIComponent(pathname || "/aluno");
    router.replace(`/login?motivo=sessao-expirada&callbackUrl=${callbackUrl}`);
  }, [router, pathname]);
}

interface ResourceState<T> {
  key: string | null;
  data?: T;
  error?: unknown;
}

/**
 * Minimal data loader for client components: loads `load()` whenever `key`
 * changes (or `reload()` is called) and redirects to /login on 401.
 */
export function useApiResource<T>(key: string | null, load: () => Promise<T>) {
  const [state, setState] = useState<ResourceState<T>>({ key: null });
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  const onUnauthenticated = useSessionExpiredRedirect();

  useEffect(() => {
    loadRef.current = load;
  });

  const fullKey = key === null ? null : `${key}#${nonce}`;

  useEffect(() => {
    if (fullKey === null) return;
    let cancelled = false;
    loadRef.current().then(
      (data) => {
        if (!cancelled) setState({ key: fullKey, data });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (isUnauthenticated(error)) onUnauthenticated();
        // Keep the last data of the same resource (e.g. a failed background refresh).
        setState((prev) => ({
          key: fullKey,
          error,
          data: key !== null && prev.key?.startsWith(`${key}#`) ? prev.data : undefined,
        }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fullKey, key, onUnauthenticated]);

  const current = state.key === fullKey;
  const sameResource = key !== null && state.key?.startsWith(`${key}#`);
  return {
    /** Keeps showing the previous data of the same resource while reloading. */
    data: sameResource ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: !current,
    reload: useCallback(() => setNonce((n) => n + 1), []),
  };
}
