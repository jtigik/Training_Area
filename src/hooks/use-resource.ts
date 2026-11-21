"use client";

import { useCallback, useEffect, useState } from "react";

export interface Resource<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload: () => void;
  /** Atualiza o dado local (ex.: após salvar) sem novo fetch. */
  setData: (value: T) => void;
}

/**
 * Carrega um recurso assíncrono do client. `key` muda → recarrega.
 * Mantido simples de propósito; pode ser trocado por SWR/React Query depois.
 */
export function useResource<T>(fetcher: () => Promise<T>, key: string): Resource<T> {
  const [state, setState] = useState<{ key: string; data?: T; error?: Error; loading: boolean }>({
    key,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);

  if (state.key !== key && !state.loading) {
    setState({ key, loading: true });
  }

  useEffect(() => {
    let active = true;
    fetcher().then(
      (data) => active && setState({ key, data, loading: false }),
      (error: unknown) =>
        active &&
        setState({
          key,
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
        }),
    );
    return () => {
      active = false;
    };
    // `fetcher` é recriado a cada render; `key` e `nonce` controlam o recarregamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    setNonce((n) => n + 1);
  }, []);
  const setData = useCallback(
    (data: T) => setState((s) => ({ ...s, data, error: undefined, loading: false })),
    [],
  );

  return { data: state.data, error: state.error, loading: state.loading, reload, setData };
}
