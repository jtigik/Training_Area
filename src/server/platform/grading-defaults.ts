import "server-only";

import { DEFAULT_GRADING_BANDS, type GradingBands } from "@/lib/grading";
import type { GradingBandsInput } from "@/lib/validation/grading";
import { writeAudit } from "@/server/audit";
import { prisma } from "@/server/db";

const ID = "platform";
const BANDS = { edMinPercent: true, dMinPercent: true, pdMinPercent: true } as const;

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Faixas padrão da plataforma (linha única; cai no 50/70/90 do código se ausente). */
export async function getGradingDefaults(db: Tx | typeof prisma = prisma): Promise<GradingBands> {
  const row = await db.platformGradingDefaults.findUnique({ where: { id: ID }, select: BANDS });
  return row ?? { ...DEFAULT_GRADING_BANDS };
}

/**
 * SUPER_ADMIN: altera o padrão. Só afeta instituições criadas DEPOIS
 * (createTenant copia para TenantGradingConfig); as existentes não mudam.
 */
export async function setGradingDefaults(actorId: string, bands: GradingBandsInput) {
  return prisma.$transaction(async (tx) => {
    const before = await getGradingDefaults(tx);
    const row = await tx.platformGradingDefaults.upsert({
      where: { id: ID },
      update: { ...bands, updatedById: actorId },
      create: { id: ID, ...bands, updatedById: actorId },
      select: BANDS,
    });
    await writeAudit(tx, {
      tenantId: null,
      actorId,
      action: "grading_defaults.updated",
      entityType: "PlatformGradingDefaults",
      entityId: ID,
      data: { before, after: row },
    });
    return row;
  });
}
