import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import type { TenantCreateInput, TenantUpdateInput } from "@/lib/validation/tenant";
import { invalidateTenantSummary } from "@/server/auth/tenant-summary";
import { prisma } from "@/server/db";

/** Campos da instituição visíveis ao SUPER_ADMIN (sem dados de pessoas). */
const TENANT_SELECT = {
  id: true,
  name: true,
  slug: true,
  emailDomains: true,
  autoJoinByDomain: true,
  locale: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

function conflictOnSlug(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ApiError(
      409,
      "SLUG_IN_USE",
      "Já existe uma instituição com este identificador (slug)",
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    throw new ApiError(404, "NOT_FOUND", "Instituição não encontrada");
  }
  throw error;
}

export function listTenants() {
  return prisma.tenant.findMany({ select: TENANT_SELECT, orderBy: { name: "asc" } });
}

export async function createTenant(input: TenantCreateInput) {
  return prisma.tenant.create({ data: input, select: TENANT_SELECT }).catch(conflictOnSlug);
}

/** Atualiza (inclusive desativar: active=false bloqueia novos logins da instituição). */
export async function updateTenant(id: string, input: TenantUpdateInput) {
  const tenant = await prisma.tenant
    .update({ where: { id }, data: input, select: TENANT_SELECT })
    .catch(conflictOnSlug);
  invalidateTenantSummary(id);
  return tenant;
}
