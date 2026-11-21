import "server-only";

import { forTenant } from "@/server/tenant-db";
import { createTenantSummaryCache } from "@/server/auth/tenant-summary-cache";

export type { TenantSummary } from "@/server/auth/tenant-summary-cache";

const cache = createTenantSummaryCache((tenantId) =>
  forTenant(tenantId).tenant.findFirst({ select: { id: true, name: true, slug: true } }),
);

/** { id, name, slug } da instituição; null para SUPER_ADMIN (tenantId nulo). */
export const getTenantSummary = (tenantId: string | null | undefined) => cache.get(tenantId);
/** Chame ao renomear/alterar slug de uma instituição. */
export const invalidateTenantSummary = (tenantId?: string) => cache.invalidate(tenantId);
