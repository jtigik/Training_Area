/** Resumo da instituição exposto na sessão e em /api/me. */
export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
}

export type TenantSummaryLoader = (tenantId: string) => Promise<TenantSummary | null>;

/**
 * Cache em memória (por processo) do resumo do tenant: evita uma consulta extra
 * a cada leitura de sessão. Renomear a instituição aparece em até `ttlMs`.
 * SUPER_ADMIN (tenantId nulo) ⇒ null sem consultar.
 */
export function createTenantSummaryCache(
  loader: TenantSummaryLoader,
  ttlMs = 60_000,
  now: () => number = Date.now,
) {
  const entries = new Map<string, { value: TenantSummary | null; expiresAt: number }>();
  return {
    async get(tenantId: string | null | undefined): Promise<TenantSummary | null> {
      if (!tenantId) return null;
      const hit = entries.get(tenantId);
      if (hit && hit.expiresAt > now()) return hit.value;
      const value = await loader(tenantId);
      entries.set(tenantId, { value, expiresAt: now() + ttlMs });
      return value;
    },
    invalidate(tenantId?: string) {
      if (tenantId) entries.delete(tenantId);
      else entries.clear();
    },
  };
}
