import "server-only";

import { Prisma } from "@/generated/prisma/client";

/** Ações registradas em AuditLog (append-only). */
export type AuditAction =
  | "invitation.created"
  | "invitation.renewed"
  | "user.updated"
  | "level_attempt.concept_overridden"
  | "feedback.edited"
  | "feedback.approved"
  | "feedback.rejected"
  | "grading_defaults.updated";

export interface AuditEntry {
  tenantId: string | null;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  data?: Record<string, unknown>;
}

/** Qualquer client/transação com o delegate auditLog (base ou forTenant). */
interface AuditWriter {
  auditLog: { create(args: { data: Prisma.AuditLogUncheckedCreateInput }): Promise<unknown> };
}

/** Grava na MESMA transação da mudança (passe o `tx`), para não haver ação sem registro. */
export async function writeAudit(db: AuditWriter, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      tenantId: entry.tenantId,
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      data: entry.data === undefined ? Prisma.DbNull : (entry.data as Prisma.InputJsonValue),
    },
  });
}

/** before/after só dos campos que mudaram. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}
