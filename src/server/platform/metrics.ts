import "server-only";

import { buildPlatformMetrics, type PlatformMetrics } from "@/lib/platform-metrics";
import { prisma } from "@/server/db";

/**
 * Só AGREGADOS (groupBy/count) pelo cliente base — nenhuma linha individual sai
 * daqui. Chame apenas após requireRole("SUPER_ADMIN").
 */
export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const [tenants, usersByRole, attemptsByStatus, conceptsByTenant] = await Promise.all([
    prisma.tenant.findMany({
      select: { id: true, name: true, slug: true, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.groupBy({
      by: ["tenantId", "role"],
      where: { tenantId: { not: null } },
      _count: { _all: true },
    }),
    prisma.levelAttempt.groupBy({ by: ["tenantId", "status"], _count: { _all: true } }),
    prisma.levelAttempt.groupBy({
      by: ["tenantId", "concept"],
      where: { status: "COMPLETED", concept: { not: null } },
      _count: { _all: true },
    }),
  ]);
  return buildPlatformMetrics(tenants, usersByRole, attemptsByStatus, conceptsByTenant);
}
